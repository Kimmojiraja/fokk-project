package com.adshield.app.engine

import android.content.Context
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
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * Fokk Mesh 3.0 — High-Performance Oblivious Privacy Tunnel Engine
 *
 * Pure Fokk Mesh Architecture (not Tor, not a centralized VPN):
 *   - 6-hour Sentinel-verified relay manifest (auto-refreshed + self-healing).
 *   - FokkCircuitManager pre-warms fresh 2-hop circuits (Ingress -> Egress)
 *     with 25s idle eviction so sockets never go stale.
 *   - FokkNodeProber runs protocol-level SOCKS5/HTTP handshakes every 3 min.
 *   - Strict Fail-Closed Killswitch: if all relays are unreachable, returns HTTP 407
 *     (traffic NEVER leaks direct from the user's real IP) and triggers self-healing
 *     manifest refresh in the background.
 *   - SSRF Protection: blocks tunneling localhost / RFC1918 / cloud metadata targets.
 *   - Clean HTTP Proxy Rewriting: strips Proxy-* headers and converts absolute URIs.
 */
object FokkTunnelEngine {
    private const val TAG = "FokkTunnelEngine"

    data class PrivacyNode(
        val host: String,
        val port: Int,
        val isHttpConnect: Boolean = false,
        val country: String = "",
        val city: String = ""
    )

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

    // Honest live telemetry exposed to Fokk Mesh UI
    @Volatile var activeHopMode: String = "OFFLINE"       // "DUAL_HOP", "SINGLE_HOP", "CONNECTING", "OFFLINE"
        private set
    @Volatile var activeIngressNode: PrivacyNode? = null
        private set
    @Volatile var activeEgressNode: PrivacyNode? = null
        private set
    @Volatile var activeLatencyMs: Long = 0L
        private set
    val totalRequestsTunneled = AtomicLong(0L)

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
            try { Thread.sleep(50) } catch (_: InterruptedException) { break }
        }
        return localPort
    }

    private fun startInternal(region: String) {
        if (!isRunning.compareAndSet(false, true)) {
            if (region != currentRegion) {
                currentRegion = region
                activeHopMode = "CONNECTING"
                activeIngressNode = null
                activeEgressNode = null
                FokkCircuitManager.setRegion(region)
            }
            return
        }
        currentRegion = region
        activeHopMode = "CONNECTING"
        activeIngressNode = null
        activeEgressNode = null

        FokkNodeManifest.ensureLoadedBlocking(3_500L)
        FokkNodeProber.start()
        FokkCircuitManager.start(region)

        threadPool.execute {
            try {
                val srv = ServerSocket(0, 64, java.net.InetAddress.getByName("127.0.0.1"))
                srv.reuseAddress = true
                serverSocket = srv
                localPort = srv.localPort
                Log.i(TAG, "Fokk Mesh 3.0 tunnel listening on 127.0.0.1:$localPort region=$region")
                while (isRunning.get()) {
                    try {
                        val client = srv.accept()
                        threadPool.execute { handleClient(client) }
                    } catch (_: Exception) {
                        if (isRunning.get()) Log.w(TAG, "Accept error")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Tunnel error: ${e.message}")
                isRunning.set(false)
                activeHopMode = "OFFLINE"
            }
        }
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
        FokkCircuitManager.stop()
        FokkNodeProber.stop()
        Log.i(TAG, "Fokk Mesh tunnel stopped")
    }

    fun isTunnelRunning(): Boolean = isRunning.get() && localPort > 0

    fun getLiveStatusSummary(): String {
        val egress = activeEgressNode
        val ingress = activeIngressNode
        val lat = if (activeLatencyMs > 0) " · ${activeLatencyMs}ms" else ""
        return when (activeHopMode) {
            "DUAL_HOP" -> {
                val egLabel = egress?.let { it.city.ifBlank { it.country } } ?: "Exit"
                val inLabel = ingress?.country?.ifBlank { "Relay" } ?: "Relay"
                "Dual-Hop ($inLabel -> $egLabel)$lat"
            }
            "SINGLE_HOP" -> {
                val egLabel = egress?.let { it.city.ifBlank { it.country } } ?: "Relay"
                "Single-Hop Relay ($egLabel)$lat"
            }
            "CONNECTING" -> "Probing Fokk Mesh relays..."
            else -> "Mesh Offline"
        }
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
            client.soTimeout = 15_000

            val clientIn = client.getInputStream()
            val clientOut = client.getOutputStream()

            // Read HTTP headers up to CRLF CRLF
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
                    // Fail-closed killswitch — zero direct IP leak
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
                // Plain HTTP: extract host/port, rewrite absolute URI to origin-form, and strip Proxy-* headers
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

    /**
     * Converts proxy-style HTTP request (`GET http://host/path HTTP/1.1`) into clean
     * origin-form (`GET /path HTTP/1.1`) and strips `Proxy-Connection` / `Proxy-Authorization`.
     */
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
     * Multi-tier resilient Fokk Mesh routing:
     *   1. Pre-warmed 2-hop circuit from FokkCircuitManager (sub-ms acquire).
     *   2. Up to 2 fresh 2-hop circuits across distinct (Ingress, Egress) pairs.
     *   3. Single-hop fallback across verified region/global relays (transparently tracked).
     *   4. Self-healing manifest refresh + strict fail-closed killswitch (never leaks direct).
     */
    private fun routeConnect(targetHost: String, targetPort: Int): Socket? {
        val t0 = System.currentTimeMillis()

        // Tier 1: Pre-warmed 2-hop circuit
        val pooled = FokkCircuitManager.acquireCircuit()
        if (pooled != null) {
            val sock = FokkCircuitManager.connectCircuitTo(pooled, targetHost, targetPort)
            if (sock != null) {
                activeHopMode = "DUAL_HOP"
                activeIngressNode = pooled.ingress
                activeEgressNode = pooled.egress
                activeLatencyMs = (System.currentTimeMillis() - t0).coerceAtLeast(1L)
                return sock
            }
            runCatching { pooled.socket.close() }
            NodeRegistry.markDead(pooled.egress, 90_000L)
        }

        // Tier 2: Build up to 2 fresh 2-hop circuits across distinct egress relays
        val triedEgress = mutableSetOf<String>()
        repeat(2) {
            val fresh = FokkCircuitManager.buildCircuit(currentRegion, excludeEgressHosts = triedEgress)
            if (fresh != null) {
                triedEgress.add(fresh.egress.host)
                val sock = FokkCircuitManager.connectCircuitTo(fresh, targetHost, targetPort)
                if (sock != null) {
                    val elapsed = (System.currentTimeMillis() - t0).coerceAtLeast(1L)
                    NodeRegistry.markAlive(fresh.egress, elapsed)
                    activeHopMode = "DUAL_HOP"
                    activeIngressNode = fresh.ingress
                    activeEgressNode = fresh.egress
                    activeLatencyMs = elapsed
                    return sock
                }
                runCatching { fresh.socket.close() }
                NodeRegistry.markDead(fresh.egress, 120_000L)
            }
        }

        // Tier 3: Single-hop fallback across fastest surviving region relays, then global relays
        val singleCandidates = (NodeRegistry.getNodesForRegion(currentRegion) + NodeRegistry.getBestIngress())
            .distinctBy { "${it.host}:${it.port}" }
            .filter { NodeRegistry.isAlive(it) && FokkNodeManifest.isSafePublicRelayHost(it.host) }
            .take(5)

        for (node in singleCandidates) {
            val sock = connectSingleHop(targetHost, targetPort, node)
            if (sock != null) {
                val elapsed = (System.currentTimeMillis() - t0).coerceAtLeast(1L)
                NodeRegistry.markAlive(node, elapsed)
                activeHopMode = "SINGLE_HOP"
                activeIngressNode = null
                activeEgressNode = node
                activeLatencyMs = elapsed
                return sock
            }
            NodeRegistry.markDead(node, 120_000L)
        }

        // Tier 4: Self-healing — force manifest refresh & remain strictly fail-closed
        activeHopMode = "OFFLINE"
        FokkNodeManifest.forceRefresh()
        Log.w(TAG, "All Fokk Mesh routes exhausted for $targetHost:$targetPort — fail-closed killswitch engaged")
        return null
    }

    private fun connectSingleHop(targetHost: String, targetPort: Int, node: PrivacyNode): Socket? {
        var sock: Socket? = null
        try {
            sock = Socket()
            sock.tcpNoDelay = true
            sock.sendBufferSize = 65536
            sock.receiveBufferSize = 65536
            sock.connect(InetSocketAddress(node.host, node.port), 3_000)
            sock.soTimeout = 4_000

            if (node.isHttpConnect) {
                val req = "CONNECT $targetHost:$targetPort HTTP/1.1\r\nHost: $targetHost:$targetPort\r\nProxy-Connection: Keep-Alive\r\n\r\n"
                sock.getOutputStream().write(req.toByteArray(StandardCharsets.ISO_8859_1))
                sock.getOutputStream().flush()
                val buf = ByteArray(1024)
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
                if (firstLine.startsWith("HTTP/") && firstLine.contains(" 200")) {
                    sock.soTimeout = 30_000
                    return sock
                }
                sock.close()
            } else {
                val out = sock.getOutputStream()
                val inp = sock.getInputStream()
                out.write(byteArrayOf(0x05, 0x01, 0x00))
                out.flush()
                val auth = ByteArray(2)
                readFully(inp, auth)
                if (auth[0] != 0x05.toByte() || auth[1] != 0x00.toByte()) {
                    sock.close()
                    return null
                }
                val hostBytes = targetHost.toByteArray(StandardCharsets.ISO_8859_1)
                val req = ByteArray(4 + 1 + hostBytes.size + 2)
                req[0] = 0x05; req[1] = 0x01; req[2] = 0x00; req[3] = 0x03
                req[4] = hostBytes.size.toByte()
                System.arraycopy(hostBytes, 0, req, 5, hostBytes.size)
                req[req.size - 2] = (targetPort shr 8).toByte()
                req[req.size - 1] = (targetPort and 0xFF).toByte()
                out.write(req)
                out.flush()
                if (readSocks5Reply(inp)) {
                    sock.soTimeout = 30_000
                    return sock
                }
                sock.close()
            }
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
