package com.adshield.app.engine

import android.content.Context
import android.util.Log
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Fokk Mesh 2.0 — High-Performance Privacy Tunnel Engine
 *
 * Architecture:
 *   - FokkCircuitManager maintains a pool of pre-warmed 2-hop circuits
 *     (ingress relay -> egress node) so every request gets a circuit instantly.
 *   - FokkNodeProber runs in background to rank nodes by real latency and
 *     mark dead nodes so they are never tried.
 *   - NodeRegistry is the single source of truth for all node data,
 *     reading from the signed FokkNodeManifest with certified builtin fallback.
 *
 * Trust model:
 *   - Only nodes in the signed manifest OR the certified builtin list are used.
 *   - No random public proxies. No unknown servers.
 *   - Killswitch: if no circuit can be built, returns 407 to the browser.
 *     Traffic NEVER falls through to a direct connection (no IP leaks).
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

    // ---------------------------------------------------------------------------
    // Region map — used by VpnEngine for display and region switching
    // ---------------------------------------------------------------------------
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

    // ---------------------------------------------------------------------------
    // Tunnel lifecycle
    // ---------------------------------------------------------------------------
    private val isRunning = AtomicBoolean(false)
    private var serverSocket: ServerSocket? = null

    @Volatile var localPort: Int = 0
        private set

    @Volatile private var currentRegion: String = "AUTO"
    @Volatile var isProMode: Boolean = false

    private val threadPool = Executors.newCachedThreadPool { r ->
        Thread(r, "fokk-tunnel-worker").also { it.isDaemon = true }
    }

    fun init(context: Context) {
        FokkNodeManifest.refreshIfNeeded()
    }

    fun start(context: Context, region: String = "AUTO") {
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
            // Already running — just update region
            if (region != currentRegion) {
                currentRegion = region
                FokkCircuitManager.setRegion(region)
            }
            return
        }
        currentRegion = region

        // Start supporting systems
        FokkNodeManifest.refreshIfNeeded()
        FokkNodeProber.start()
        FokkCircuitManager.start(region)

        threadPool.execute {
            try {
                val srv = ServerSocket(0, 50, java.net.InetAddress.getByName("127.0.0.1"))
                srv.reuseAddress = true
                serverSocket = srv
                localPort = srv.localPort
                Log.i(TAG, "Tunnel listening on 127.0.0.1:$localPort region=$region")
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
            }
        }
    }

    fun stop() {
        if (!isRunning.compareAndSet(true, false)) return
        runCatching { serverSocket?.close() }
        serverSocket = null
        localPort = 0
        FokkCircuitManager.stop()
        FokkNodeProber.stop()
        Log.i(TAG, "Tunnel stopped")
    }

    fun isTunnelRunning(): Boolean = isRunning.get() && localPort > 0

    // ---------------------------------------------------------------------------
    // Request handler
    // ---------------------------------------------------------------------------
    private fun handleClient(client: Socket) {
        var upstream: Socket? = null
        try {
            client.tcpNoDelay = true
            client.sendBufferSize = 65536
            client.receiveBufferSize = 65536
            client.soTimeout = 15_000

            val clientIn = client.getInputStream()
            val clientOut = client.getOutputStream()

            // Read HTTP headers until CRLF CRLF
            val headerBytes = ByteArray(8192)
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
                val connectedSocket = routeConnect(targetHost, targetPort)
                if (connectedSocket == null) {
                    // Killswitch — no IP leak fallback
                    clientOut.write("HTTP/1.1 407 Mesh Unavailable\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                    clientOut.flush()
                    return
                }
                upstream = connectedSocket
                clientOut.write("HTTP/1.1 200 Connection Established\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                clientOut.flush()
                pipeSockets(client, connectedSocket)
            } else {
                // Plain HTTP — route through ingress relay
                val hostHeader = requestText.lineSequence()
                    .firstOrNull { it.startsWith("Host:", ignoreCase = true) }
                    ?.substringAfter(":")?.trim() ?: target.substringBefore("/").substringBefore(":")
                val host = hostHeader.substringBefore(":")
                val port = hostHeader.substringAfter(":", "80").toIntOrNull() ?: 80
                val connectedSocket = routeConnect(host, port)
                if (connectedSocket != null) {
                    connectedSocket.getOutputStream().write(headerBytes, 0, totalRead)
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

    // ---------------------------------------------------------------------------
    // Routing — circuit pool first, inline build fallback, then single-hop
    // ---------------------------------------------------------------------------
    private fun routeConnect(targetHost: String, targetPort: Int): Socket? {
        // 1. Try warm circuit from pool
        val circuit = FokkCircuitManager.acquireCircuit()
        if (circuit != null) {
            val sock = FokkCircuitManager.connectCircuitTo(circuit, targetHost, targetPort)
            if (sock != null) {
                sock.soTimeout = 30_000
                return sock
            }
            // Circuit failed — close it, don't return it to pool
            runCatching { circuit.socket.close() }
            NodeRegistry.markDead(circuit.egress, 60_000L)
        }

        // 2. Build a fresh circuit inline (no warm circuit available)
        val egress = NodeRegistry.getNodesForRegion(currentRegion).firstOrNull()
        if (egress != null) {
            val freshCircuit = FokkCircuitManager.buildCircuitTo(egress)
            if (freshCircuit != null) {
                val sock = FokkCircuitManager.connectCircuitTo(freshCircuit, targetHost, targetPort)
                if (sock != null) {
                    sock.soTimeout = 30_000
                    NodeRegistry.markAlive(egress, 0L)
                    return sock
                }
                runCatching { freshCircuit.socket.close() }
                NodeRegistry.markDead(egress)
            }
        }

        // 3. Single-hop fallback through best ingress relay
        val ingress = NodeRegistry.getBestIngress().firstOrNull()
        if (ingress != null) {
            val sock = connectSingleHop(targetHost, targetPort, ingress)
            if (sock != null) {
                NodeRegistry.markAlive(ingress, 0L)
                return sock
            }
            NodeRegistry.markDead(ingress)
        }

        // 4. Try any surviving node single-hop
        for (node in NodeRegistry.getAllNodes()) {
            if (!NodeRegistry.isAlive(node)) continue
            val sock = connectSingleHop(targetHost, targetPort, node)
            if (sock != null) {
                NodeRegistry.markAlive(node, 0L)
                return sock
            }
            NodeRegistry.markDead(node)
        }

        // All routes exhausted — killswitch (no direct fallback)
        Log.w(TAG, "All routes exhausted for $targetHost:$targetPort — returning null (killswitch)")
        return null
    }

    // ---------------------------------------------------------------------------
    // Single-hop SOCKS5/HTTP connect
    // ---------------------------------------------------------------------------
    private fun connectSingleHop(targetHost: String, targetPort: Int, node: PrivacyNode): Socket? {
        var sock: Socket? = null
        try {
            sock = Socket()
            sock.tcpNoDelay = true
            sock.sendBufferSize = 65536
            sock.receiveBufferSize = 65536
            sock.connect(InetSocketAddress(node.host, node.port), 3_500)
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
                        buf[n-4] == '\r'.code.toByte() && buf[n-3] == '\n'.code.toByte() &&
                        buf[n-2] == '\r'.code.toByte() && buf[n-1] == '\n'.code.toByte()) break
                }
                val resp = String(buf, 0, n, StandardCharsets.ISO_8859_1)
                if (resp.contains("200")) {
                    sock.soTimeout = 30_000
                    return sock
                }
                sock.close()
            } else {
                val out = sock.getOutputStream()
                val inp = sock.getInputStream()
                // SOCKS5 greeting
                out.write(byteArrayOf(0x05, 0x01, 0x00))
                out.flush()
                val auth = ByteArray(2)
                readFully(inp, auth)
                if (auth[0] != 0x05.toByte() || auth[1] != 0x00.toByte()) {
                    sock.close()
                    return null
                }
                // SOCKS5 CONNECT
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

    // ---------------------------------------------------------------------------
    // Bidirectional socket relay
    // ---------------------------------------------------------------------------
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
                // Nym-inspired micro-jitter on first 2 packets (handshake phase only)
                // Decorrelates timing fingerprint without impacting throughput
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

    // ---------------------------------------------------------------------------
    // SOCKS5 protocol helpers
    // ---------------------------------------------------------------------------
    private fun readFully(stream: InputStream, buffer: ByteArray) {
        var offset = 0
        while (offset < buffer.size) {
            val n = stream.read(buffer, offset, buffer.size - offset)
            if (n < 0) throw java.io.EOFException("Premature EOF (got $offset/${buffer.size})")
            offset += n
        }
    }

    private fun readSocks5Reply(stream: InputStream): Boolean {
        val header = ByteArray(4)
        readFully(stream, header)
        if (header[0] != 0x05.toByte() || header[1] != 0x00.toByte()) return false
        when (header[3].toInt()) {
            0x01 -> { val b = ByteArray(6);  readFully(stream, b) }
            0x03 -> { val l = stream.read(); if (l < 0) return false; val b = ByteArray(l + 2); readFully(stream, b) }
            0x04 -> { val b = ByteArray(18); readFully(stream, b) }
            else -> return false
        }
        return true
    }
}
