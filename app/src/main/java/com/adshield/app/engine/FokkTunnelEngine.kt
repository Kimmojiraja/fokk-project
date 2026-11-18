package com.adshield.app.engine

import android.content.Context
import android.util.Base64
import android.util.Log
import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URI
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory

/**
 * Fokk Mesh 3.1 — High-Performance Oblivious Privacy Tunnel Engine
 *
 * Pure Fokk Mesh Architecture (not Tor, not a commercial VPN):
 *   - Instant local bind (<2ms) + parallel manifest racing (no 404 cold-start stalls).
 *   - Supports authenticated relays (SOCKS5 RFC 1929 username/password & HTTP Basic)
 *     and TLS-over-SOCKS5 (`useTls = true`, strict HTTPS hostname verification) for
 *     100% ISP-encrypted, un-abusable private Fokk Mesh relays.
 *   - Pre-warmed 2-hop circuits (Ingress -> Egress) with parallel Happy-Eyeballs
 *     single-hop racing so pages load fast even on high-latency mobile networks.
 *   - Strictly fail-closed (`407 Mesh Unavailable`) if zero relays respond — zero IP leaks.
 */
object FokkTunnelEngine {
    private const val TAG = "FokkTunnelEngine"

    data class PrivacyNode(
        val host: String,
        val port: Int,
        val isHttpConnect: Boolean = false,
        val country: String = "",
        val city: String = "",
        val username: String = "",
        val password: String = "",
        val useTls: Boolean = false,
        val tlsServerName: String = ""
    ) {
        val hasAuth: Boolean get() = username.isNotBlank() && password.isNotBlank()
    }

    val REGION_NODES: Map<String, String> = mapOf(
        "AM" to "Americas",
        "EU" to "Europe",
        "AS" to "Asia & Pacific",
        "US" to "United States",
        "GB" to "United Kingdom",
        "DE" to "Germany",
        "NL" to "Netherlands",
        "FR" to "France",
        "SE" to "Sweden",
        "CA" to "Canada",
        "JP" to "Japan",
        "KR" to "South Korea",
        "SG" to "Singapore",
        "HK" to "Hong Kong",
        "IN" to "India",
        "CH" to "Switzerland",
        "IT" to "Italy",
        "BR" to "Brazil"
    )

    private val isRunning = AtomicBoolean(false)
    private var serverSocket: ServerSocket? = null

    @Volatile var localPort: Int = 0
        private set

    @Volatile private var currentRegion: String = "AUTO"
    @Volatile var isProMode: Boolean = false

    // Live telemetry exposed to Fokk Mesh UI
    @Volatile var activeHopMode: String = "OFFLINE"       // "DUAL_HOP", "SINGLE_HOP", "CONNECTING", "OFFLINE"
        private set
    @Volatile var activeIngressNode: PrivacyNode? = null
        private set
    @Volatile var activeEgressNode: PrivacyNode? = null
        private set
    @Volatile var activeLatencyMs: Long = 0L
        private set
    @Volatile var activeTransportEncrypted: Boolean = false
        private set
    val totalRequestsTunneled = AtomicLong(0L)

    // Sticky fastest-relay cache (avoids flooding 3 sockets per asset once fastest relay is elected)
    @Volatile private var stickyBestNode: PrivacyNode? = null
    @Volatile private var stickyRegion: String = ""
    @Volatile private var stickyUpdatedAt: Long = 0L
    private const val STICKY_TTL_MS = 90_000L

    private val threadPool = Executors.newCachedThreadPool { r ->
        Thread(r, "fokk-tunnel-worker").also { it.isDaemon = true }
    }

    fun init(context: Context) {
        FokkNodeManifest.init(context)
    }

    fun start(context: Context, region: String = "AUTO") {
        FokkNodeManifest.init(context)
        startInternal(region)
    }

    fun start(region: String = "AUTO", proMode: Boolean = false): Int {
        isProMode = proMode
        startInternal(region)
        val deadline = System.currentTimeMillis() + 2_000
        while (localPort <= 0 && System.currentTimeMillis() < deadline) {
            try { Thread.sleep(25) } catch (_: InterruptedException) { break }
        }
        return localPort
    }

    private fun startInternal(region: String) {
        if (!isRunning.compareAndSet(false, true)) {
            if (region != currentRegion) {
                currentRegion = region
                stickyBestNode = null
                stickyRegion = ""
                activeHopMode = "CONNECTING"
                activeIngressNode = null
                activeEgressNode = null
                FokkCircuitManager.setRegion(region)
            }
            return
        }
        currentRegion = region
        stickyBestNode = null
        stickyRegion = ""
        activeHopMode = "CONNECTING"
        activeIngressNode = null
        activeEgressNode = null
        activeTransportEncrypted = false

        // 1. Bind local loopback ServerSocket IMMEDIATELY (<2ms) — NEVER block localPort on network I/O!
        threadPool.execute {
            try {
                val srv = ServerSocket(0, 64, java.net.InetAddress.getByName("127.0.0.1"))
                srv.reuseAddress = true
                serverSocket = srv
                localPort = srv.localPort
                Log.i(TAG, "Fokk Mesh 3.1 tunnel listening on 127.0.0.1:$localPort region=$region")
                while (isRunning.get()) {
                    try {
                        val client = srv.accept()
                        threadPool.execute { handleClient(client) }
                    } catch (_: Exception) {
                        if (isRunning.get()) Log.w(TAG, "Accept error")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Tunnel bind error: ${e.message}")
                isRunning.set(false)
                activeHopMode = "OFFLINE"
            }
        }

        // 2. Kick off non-blocking parallel manifest refresh, protocol prober, and circuit pre-warmer
        FokkNodeManifest.refreshIfNeeded()
        FokkNodeProber.start()
        FokkCircuitManager.start(region)
    }

    fun stop() {
        if (!isRunning.compareAndSet(true, false)) return
        runCatching { serverSocket?.close() }
        serverSocket = null
        localPort = 0
        activeHopMode = "OFFLINE"
        activeIngressNode = null
        activeEgressNode = null
        activeLatencyMs = 0L
        activeTransportEncrypted = false
        stickyBestNode = null
        stickyRegion = ""
        FokkCircuitManager.stop()
        FokkNodeProber.stop()
        Log.i(TAG, "Fokk Mesh tunnel stopped")
    }

    fun isTunnelRunning(): Boolean = isRunning.get() && localPort > 0

    fun getLiveStatusSummary(): String {
        val egress = activeEgressNode
        val ingress = activeIngressNode
        val lat = if (activeLatencyMs > 0) " · ${activeLatencyMs}ms" else ""
        val tlsTag = if (activeTransportEncrypted) " · TLS" else ""
        return when (activeHopMode) {
            "DUAL_HOP" -> {
                val egLabel = egress?.let { it.city.ifBlank { it.country } } ?: "Exit"
                val inLabel = ingress?.country?.ifBlank { "Relay" } ?: "Relay"
                "Dual-Hop ($inLabel -> $egLabel)$tlsTag$lat"
            }
            "SINGLE_HOP" -> {
                val egLabel = egress?.let { it.city.ifBlank { it.country } } ?: "Relay"
                "Mesh Relay ($egLabel)$tlsTag$lat"
            }
            "CONNECTING" -> "Connecting Fokk Mesh..."
            else -> "Mesh Offline"
        }
    }

    // -------------------------------------------------------------------------
    // Shared Transport Helpers (TLS-over-SOCKS5 + RFC 1929 Auth + HTTP Basic)
    // -------------------------------------------------------------------------

    /**
     * Opens a TCP socket to a Fokk Mesh relay, optionally wrapping it in strict TLS
     * (`node.useTls == true`) so Hop-1 traffic is 100% encrypted against local ISP/Wi-Fi inspection.
     */
    fun openRelaySocket(node: PrivacyNode, connectTimeoutMs: Int, ioTimeoutMs: Int): Socket {
        val raw = Socket()
        raw.tcpNoDelay = true
        raw.sendBufferSize = 65536
        raw.receiveBufferSize = 65536
        try {
            raw.connect(InetSocketAddress(node.host, node.port), connectTimeoutMs)
            raw.soTimeout = ioTimeoutMs
            if (!node.useTls) return raw

            val sniHost = node.tlsServerName.ifBlank { node.host }
            val sslFactory = SSLSocketFactory.getDefault() as SSLSocketFactory
            val sslSocket = sslFactory.createSocket(raw, sniHost, node.port, true) as SSLSocket
            sslSocket.soTimeout = ioTimeoutMs
            sslSocket.sslParameters = sslSocket.sslParameters.apply {
                endpointIdentificationAlgorithm = "HTTPS"
            }
            sslSocket.startHandshake()
            return sslSocket
        } catch (e: Exception) {
            runCatching { raw.close() }
            throw e
        }
    }

    /**
     * Performs SOCKS5 greeting + optional RFC 1929 Username/Password authentication.
     */
    fun performSocks5GreetingAndAuth(inp: InputStream, out: OutputStream, node: PrivacyNode): Boolean {
        if (node.hasAuth) {
            // Offer NO AUTH (0x00) and USERNAME/PASSWORD (0x02)
            out.write(byteArrayOf(0x05, 0x02, 0x00, 0x02))
        } else {
            out.write(byteArrayOf(0x05, 0x01, 0x00))
        }
        out.flush()

        val greet = ByteArray(2)
        readFully(inp, greet)
        if (greet[0] != 0x05.toByte()) return false

        return when (greet[1]) {
            0x00.toByte() -> true
            0x02.toByte() -> {
                if (!node.hasAuth) return false
                val userBytes = node.username.toByteArray(StandardCharsets.UTF_8)
                val passBytes = node.password.toByteArray(StandardCharsets.UTF_8)
                if (userBytes.size > 255 || passBytes.size > 255) return false
                val authReq = ByteArray(3 + userBytes.size + passBytes.size)
                authReq[0] = 0x01 // RFC 1929 subnegotiation version
                authReq[1] = userBytes.size.toByte()
                System.arraycopy(userBytes, 0, authReq, 2, userBytes.size)
                authReq[2 + userBytes.size] = passBytes.size.toByte()
                System.arraycopy(passBytes, 0, authReq, 3 + userBytes.size, passBytes.size)
                out.write(authReq)
                out.flush()
                val authResp = ByteArray(2)
                readFully(inp, authResp)
                authResp[0] == 0x01.toByte() && authResp[1] == 0x00.toByte()
            }
            else -> false
        }
    }

    fun sendSocks5Connect(inp: InputStream, out: OutputStream, targetHost: String, targetPort: Int): Boolean {
        val hostBytes = targetHost.toByteArray(StandardCharsets.ISO_8859_1)
        val req = ByteArray(4 + 1 + hostBytes.size + 2)
        req[0] = 0x05; req[1] = 0x01; req[2] = 0x00; req[3] = 0x03
        req[4] = hostBytes.size.toByte()
        System.arraycopy(hostBytes, 0, req, 5, hostBytes.size)
        req[req.size - 2] = (targetPort shr 8).toByte()
        req[req.size - 1] = (targetPort and 0xFF).toByte()
        out.write(req)
        out.flush()
        return readSocks5Reply(inp)
    }

    fun performHttpConnect(sock: Socket, targetHost: String, targetPort: Int, node: PrivacyNode): Boolean {
        val sb = StringBuilder()
        sb.append("CONNECT $targetHost:$targetPort HTTP/1.1\r\n")
        sb.append("Host: $targetHost:$targetPort\r\n")
        if (node.hasAuth) {
            val token = Base64.encodeToString("${node.username}:${node.password}".toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP)
            sb.append("Proxy-Authorization: Basic $token\r\n")
        }
        sb.append("Proxy-Connection: Keep-Alive\r\n\r\n")
        sock.getOutputStream().write(sb.toString().toByteArray(StandardCharsets.ISO_8859_1))
        sock.getOutputStream().flush()

        val buf = ByteArray(2048)
        var n = 0
        val inp = sock.getInputStream()
        while (n < buf.size) {
            val b = inp.read()
            if (b == -1) break
            buf[n++] = b.toByte()
            if (n >= 4 &&
                buf[n - 4] == '\r'.code.toByte() && buf[n - 3] == '\n'.code.toByte() &&
                buf[n - 2] == '\r'.code.toByte() && buf[n - 1] == '\n'.code.toByte()
            ) break
        }
        val firstLine = String(buf, 0, n, StandardCharsets.ISO_8859_1).substringBefore("\r\n")
        return firstLine.startsWith("HTTP/") && firstLine.contains(" 200")
    }

    private fun isBlockedPrivateTarget(host: String): Boolean {
        val h = host.trim().lowercase(Locale.ROOT).removePrefix("[").removeSuffix("]")
        return h == "localhost" ||
            h == "::1" ||
            h.startsWith("127.") ||
            h.startsWith("169.254.") ||
            h.startsWith("0.") ||
            h.startsWith("10.") ||
            h.startsWith("192.168.")
    }

    private fun handleClient(client: Socket) {
        var upstream: Socket? = null
        try {
            client.tcpNoDelay = true
            client.sendBufferSize = 65536
            client.receiveBufferSize = 65536
            client.soTimeout = 20_000

            val clientIn = client.getInputStream()
            val clientOut = client.getOutputStream()

            val headerBytes = ByteArray(16384)
            var totalRead = 0
            while (totalRead < headerBytes.size) {
                val b = clientIn.read()
                if (b == -1) break
                headerBytes[totalRead++] = b.toByte()
                if (totalRead >= 4 &&
                    headerBytes[totalRead - 4] == '\r'.code.toByte() &&
                    headerBytes[totalRead - 3] == '\n'.code.toByte() &&
                    headerBytes[totalRead - 2] == '\r'.code.toByte() &&
                    headerBytes[totalRead - 1] == '\n'.code.toByte()
                ) break
            }
            if (totalRead == 0) return

            val requestText = String(headerBytes, 0, totalRead, StandardCharsets.ISO_8859_1)
            val firstLine = requestText.substringBefore("\r\n")
            val parts = firstLine.split(" ")
            if (parts.size < 2) return
            val method = parts[0].uppercase(Locale.ROOT)
            val target = parts[1]

            if (method == "CONNECT") {
                val targetHost = target.substringBefore(":")
                val targetPort = target.substringAfter(":", "443").toIntOrNull() ?: 443
                if (targetHost.isBlank() || targetPort !in 1..65535 || isBlockedPrivateTarget(targetHost)) {
                    clientOut.write("HTTP/1.1 403 Forbidden\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                    clientOut.flush()
                    return
                }
                val connectedSocket = routeConnect(targetHost, targetPort)
                if (connectedSocket == null) {
                    clientOut.write("HTTP/1.1 407 Mesh Unavailable\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                    clientOut.flush()
                    return
                }
                totalRequestsTunneled.incrementAndGet()
                upstream = connectedSocket
                clientOut.write("HTTP/1.1 200 Connection Established\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                clientOut.flush()
                pipeSockets(client, connectedSocket)
            } else {
                val parsedUri = runCatching { URI(target) }.getOrNull()
                val hostHeader = requestText.lineSequence()
                    .firstOrNull { it.startsWith("Host:", ignoreCase = true) }
                    ?.substringAfter(":")?.trim()
                val host = (parsedUri?.host?.takeIf { it.isNotBlank() }
                    ?: hostHeader?.substringBefore(":")
                    ?: target.substringBefore("/").substringBefore(":")).trim()
                val port = when {
                    parsedUri != null && parsedUri.port in 1..65535 -> parsedUri.port
                    hostHeader != null && hostHeader.contains(":") -> hostHeader.substringAfter(":").toIntOrNull() ?: 80
                    else -> 80
                }
                if (host.isBlank() || isBlockedPrivateTarget(host)) {
                    clientOut.write("HTTP/1.1 403 Forbidden\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                    clientOut.flush()
                    return
                }
                val connectedSocket = routeConnect(host, port)
                if (connectedSocket != null) {
                    totalRequestsTunneled.incrementAndGet()
                    val cleanHttpRequest = rewritePlainHttpRequest(requestText, parsedUri)
                    connectedSocket.getOutputStream().write(cleanHttpRequest.toByteArray(StandardCharsets.ISO_8859_1))
                    connectedSocket.getOutputStream().flush()
                    upstream = connectedSocket
                    pipeSockets(client, connectedSocket)
                } else {
                    clientOut.write("HTTP/1.1 407 Mesh Unavailable\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                    clientOut.flush()
                }
            }
        } catch (_: Exception) {
        } finally {
            runCatching { client.close() }
            runCatching { upstream?.close() }
        }
    }

    private fun rewritePlainHttpRequest(requestText: String, parsedUri: URI?): String {
        val lines = requestText.split("\r\n")
        if (lines.isEmpty()) return requestText
        val firstParts = lines[0].split(" ")
        val sb = StringBuilder()
        if (firstParts.size >= 3 && parsedUri != null && !parsedUri.scheme.isNullOrBlank()) {
            val path = (parsedUri.rawPath?.ifBlank { "/" } ?: "/") +
                (parsedUri.rawQuery?.let { "?$it" } ?: "")
            sb.append("${firstParts[0]} $path ${firstParts[2]}\r\n")
        } else {
            sb.append(lines[0]).append("\r\n")
        }
        for (i in 1 until lines.size) {
            val line = lines[i]
            if (line.isEmpty()) {
                sb.append("\r\n")
                break
            }
            if (line.startsWith("Proxy-Connection:", ignoreCase = true) ||
                line.startsWith("Proxy-Authorization:", ignoreCase = true)
            ) {
                continue
            }
            sb.append(line).append("\r\n")
        }
        return sb.toString()
    }

    /**
     * Ultra-resilient Fokk Mesh routing:
     *   0. Wait up to 4.5s for live manifest ONLY if zero relays loaded yet (first cold request).
     *   1. Pre-warmed 2-hop circuit from FokkCircuitManager (sub-ms acquire).
     *   2. Parallel Happy-Eyeballs race across top 3 relays (fastest live relay wins in ~1-2s;
     *      never stalls sequentially across dead nodes or locks out all nodes!).
     *   3. Global fallback race across remaining relays if region relays failed.
     *   4. Strictly fail-closed (null -> 407) + self-healing manifest refresh.
     */
    private fun routeConnect(targetHost: String, targetPort: Int): Socket? {
        val t0 = System.currentTimeMillis()
        if (NodeRegistry.getAllNodes().isEmpty()) {
            FokkNodeManifest.ensureLoadedBlocking(4_500L)
        }

        // Tier 1: Pre-warmed 2-hop circuit (instant 0ms acquire when warm)
        val pooled = FokkCircuitManager.acquireCircuit()
        if (pooled != null) {
            val sock = FokkCircuitManager.connectCircuitTo(pooled, targetHost, targetPort)
            if (sock != null) {
                activeHopMode = "DUAL_HOP"
                activeIngressNode = pooled.ingress
                activeEgressNode = pooled.egress
                activeTransportEncrypted = pooled.ingress.useTls
                activeLatencyMs = (System.currentTimeMillis() - t0).coerceAtLeast(1L)
                return sock
            }
            runCatching { pooled.socket.close() }
            NodeRegistry.markDead(pooled.egress, 45_000L)
        }

        // Tier 2: Sticky Fastest-Relay Fast-Path (1 direct socket — no 3x socket flood per asset!)
        val sticky = stickyBestNode
        if (sticky != null &&
            stickyRegion == currentRegion &&
            System.currentTimeMillis() - stickyUpdatedAt < STICKY_TTL_MS &&
            NodeRegistry.isAlive(sticky)
        ) {
            val sock = connectSingleHop(targetHost, targetPort, sticky)
            if (sock != null) {
                val elapsed = (System.currentTimeMillis() - t0).coerceAtLeast(1L)
                NodeRegistry.markAlive(sticky, elapsed)
                activeHopMode = "SINGLE_HOP"
                activeIngressNode = null
                activeEgressNode = sticky
                activeTransportEncrypted = sticky.useTls
                activeLatencyMs = elapsed
                return sock
            }
            stickyBestNode = null
            NodeRegistry.markDead(sticky, 45_000L)
        }

        // Tier 3: Happy-Eyeballs parallel race across top 3 region relays to elect new sticky fastest relay
        val regionCandidates = NodeRegistry.getNodesForRegion(currentRegion)
            .filter { FokkNodeManifest.isSafePublicRelayHost(it.host) }
        val firstWave = regionCandidates.take(3)
        val race1 = raceSingleHopRelays(firstWave, targetHost, targetPort, 6_500L)
        if (race1 != null) {
            val (node, sock) = race1
            val elapsed = (System.currentTimeMillis() - t0).coerceAtLeast(1L)
            NodeRegistry.markAlive(node, elapsed)
            stickyBestNode = node
            stickyRegion = currentRegion
            stickyUpdatedAt = System.currentTimeMillis()
            activeHopMode = "SINGLE_HOP"
            activeIngressNode = null
            activeEgressNode = node
            activeTransportEncrypted = node.useTls
            activeLatencyMs = elapsed
            return sock
        }

        // Tier 4: Second wave race across any remaining global relays
        val triedKeys = firstWave.map { "${it.host}:${it.port}" }.toSet()
        val globalCandidates = (regionCandidates.drop(3) + NodeRegistry.getAllNodes())
            .distinctBy { "${it.host}:${it.port}" }
            .filter { "${it.host}:${it.port}" !in triedKeys && FokkNodeManifest.isSafePublicRelayHost(it.host) }
            .take(4)
        val race2 = raceSingleHopRelays(globalCandidates, targetHost, targetPort, 7_500L)
        if (race2 != null) {
            val (node, sock) = race2
            val elapsed = (System.currentTimeMillis() - t0).coerceAtLeast(1L)
            NodeRegistry.markAlive(node, elapsed)
            stickyBestNode = node
            stickyRegion = currentRegion
            stickyUpdatedAt = System.currentTimeMillis()
            activeHopMode = "SINGLE_HOP"
            activeIngressNode = null
            activeEgressNode = node
            activeTransportEncrypted = node.useTls
            activeLatencyMs = elapsed
            return sock
        }

        // Tier 4: Self-healing manifest refresh + strict fail-closed killswitch (never leaks direct)
        activeHopMode = "OFFLINE"
        FokkNodeManifest.forceRefresh()
        Log.w(TAG, "All Fokk Mesh routes exhausted for $targetHost:$targetPort — fail-closed killswitch")
        return null
    }

    /**
     * Races up to N candidate relays in parallel; returns the first connected (node, socket)
     * and cleanly closes any slower sockets so zero file descriptors leak.
     */
    private fun raceSingleHopRelays(
        candidates: List<PrivacyNode>,
        targetHost: String,
        targetPort: Int,
        overallTimeoutMs: Long
    ): Pair<PrivacyNode, Socket>? {
        if (candidates.isEmpty()) return null
        if (candidates.size == 1) {
            val node = candidates[0]
            val sock = connectSingleHop(targetHost, targetPort, node)
            if (sock != null) return node to sock
            NodeRegistry.markDead(node, 45_000L)
            return null
        }

        val winner = AtomicReference<Pair<PrivacyNode, Socket>?>(null)
        val doneLatch = CountDownLatch(1)
        val allFinished = CountDownLatch(candidates.size)

        for (node in candidates) {
            threadPool.execute {
                var s: Socket? = null
                try {
                    if (winner.get() != null) return@execute
                    s = connectSingleHop(targetHost, targetPort, node)
                    if (s != null) {
                        if (winner.compareAndSet(null, node to s)) {
                            doneLatch.countDown()
                        } else {
                            runCatching { s.close() }
                        }
                    } else {
                        NodeRegistry.markDead(node, 45_000L)
                    }
                } catch (_: Exception) {
                    runCatching { s?.close() }
                } finally {
                    allFinished.countDown()
                    if (allFinished.count == 0L) doneLatch.countDown()
                }
            }
        }

        runCatching { doneLatch.await(overallTimeoutMs, TimeUnit.MILLISECONDS) }
        return winner.get()
    }

    private fun connectSingleHop(targetHost: String, targetPort: Int, node: PrivacyNode): Socket? {
        var sock: Socket? = null
        try {
            sock = openRelaySocket(node, connectTimeoutMs = 5_000, ioTimeoutMs = 6_000)
            val ok = if (node.isHttpConnect) {
                performHttpConnect(sock, targetHost, targetPort, node)
            } else {
                val inp = sock.getInputStream()
                val out = sock.getOutputStream()
                performSocks5GreetingAndAuth(inp, out, node) && sendSocks5Connect(inp, out, targetHost, targetPort)
            }
            if (ok) {
                sock.soTimeout = 30_000
                return sock
            }
            runCatching { sock.close() }
        } catch (_: Exception) {
            runCatching { sock?.close() }
        }
        return null
    }

    private fun pipeSockets(s1: Socket, s2: Socket) {
        runCatching {
            s1.tcpNoDelay = true; s2.tcpNoDelay = true
            s1.soTimeout = 30_000; s2.soTimeout = 30_000
            s1.sendBufferSize = 65536; s1.receiveBufferSize = 65536
            s2.sendBufferSize = 65536; s2.receiveBufferSize = 65536
        }
        threadPool.execute {
            try { transfer(s2.getInputStream(), s1.getOutputStream()) } catch (_: Exception) {}
            runCatching { s1.shutdownOutput() }
            runCatching { s2.close() }
            runCatching { s1.close() }
        }
        try { transfer(s1.getInputStream(), s2.getOutputStream()) } catch (_: Exception) {}
        runCatching { s2.shutdownOutput() }
        runCatching { s1.close() }
        runCatching { s2.close() }
    }

    private fun transfer(input: InputStream, output: OutputStream) {
        val buffer = ByteArray(65536)
        val random = if (isProMode) java.util.concurrent.ThreadLocalRandom.current() else null
        var packetsSeen = 0
        try {
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                packetsSeen++
                if (isProMode && random != null && packetsSeen <= 2) {
                    try { Thread.sleep(random.nextLong(1, 3)) }
                    catch (_: InterruptedException) { Thread.currentThread().interrupt(); break }
                }
                output.write(buffer, 0, read)
                if (input.available() == 0) output.flush()
            }
            output.flush()
        } catch (_: Exception) {}
    }

    private fun readFully(stream: InputStream, buffer: ByteArray) {
        var offset = 0
        while (offset < buffer.size) {
            val n = stream.read(buffer, offset, buffer.size - offset)
            if (n < 0) throw EOFException("Premature EOF (got $offset/${buffer.size})")
            offset += n
        }
    }

    private fun readSocks5Reply(stream: InputStream): Boolean {
        val header = ByteArray(4)
        readFully(stream, header)
        if (header[0] != 0x05.toByte() || header[1] != 0x00.toByte()) return false
        when (header[3].toInt()) {
            0x01 -> { val b = ByteArray(6); readFully(stream, b) }
            0x03 -> { val l = stream.read(); if (l < 0) return false; val b = ByteArray(l + 2); readFully(stream, b) }
            0x04 -> { val b = ByteArray(18); readFully(stream, b) }
            else -> return false
        }
        return true
    }
}
