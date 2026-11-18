package com.adshield.app.engine

import android.util.Log
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Fokk Mesh Circuit Manager — maintains a pool of pre-warmed 2-hop circuits.
 *
 * A "circuit" is a fully-handshaked dual-hop socket tunnel:
 *   App -> Ingress Relay (sees user IP, never sees destination)
 *       -> Egress Node   (sees ingress IP, connects to internet)
 *       -> Internet
 *
 * Pre-warming eliminates the per-request handshake penalty. When a browser
 * request arrives, it grabs a ready circuit from the pool immediately
 * (sub-millisecond) instead of waiting for a fresh TCP + SOCKS5 handshake.
 *
 * Circuit lifecycle:
 *   - Max 50 requests per circuit (rotation breaks traffic correlation)
 *   - Max 10-minute age (prevents long-term session linkability)
 *   - Broken/closed sockets are detected on acquire and discarded
 *   - Rebuilder runs continuously to keep pool at TARGET_POOL_SIZE
 */
object FokkCircuitManager {
    private const val TAG = "FokkCircuitManager"
    private const val TARGET_POOL_SIZE = 2
    private const val MAX_REQUESTS_PER_CIRCUIT = 50
    private const val MAX_CIRCUIT_AGE_MS = 10 * 60 * 1000L   // 10 minutes
    private const val BUILD_TIMEOUT_MS = 5_000

    data class Circuit(
        val socket: Socket,
        val ingress: FokkTunnelEngine.PrivacyNode,
        val egress: FokkTunnelEngine.PrivacyNode,
        val createdAt: Long = System.currentTimeMillis(),
        val requestCount: AtomicInteger = AtomicInteger(0)
    ) {
        fun isExpired(): Boolean =
            requestCount.get() >= MAX_REQUESTS_PER_CIRCUIT ||
            System.currentTimeMillis() - createdAt > MAX_CIRCUIT_AGE_MS

        fun isAlive(): Boolean = !socket.isClosed && socket.isConnected && !isExpired()
    }

    private val pool = ArrayBlockingQueue<Circuit>(TARGET_POOL_SIZE * 2)
    private val running = AtomicBoolean(false)
    private val rebuilderExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "fokk-circuit-rebuilder").also { it.isDaemon = true }
    }
    private val buildExecutor = Executors.newFixedThreadPool(TARGET_POOL_SIZE) { r ->
        Thread(r, "fokk-circuit-builder").also { it.isDaemon = true }
    }

    @Volatile var currentRegion: String = "AUTO"

    fun start(region: String) {
        currentRegion = region
        if (!running.compareAndSet(false, true)) {
            currentRegion = region
            return
        }
        Log.i(TAG, "Circuit manager started for region=$region")
        rebuilderExecutor.submit { rebuilderLoop() }
        // Pre-warm immediately
        repeat(TARGET_POOL_SIZE) {
            buildExecutor.submit { buildAndAdd() }
        }
    }

    fun stop() {
        if (!running.compareAndSet(true, false)) return
        drainPool()
        Log.i(TAG, "Circuit manager stopped")
    }

    fun setRegion(region: String) {
        if (region == currentRegion) return
        currentRegion = region
        drainPool()
        repeat(TARGET_POOL_SIZE) { buildExecutor.submit { buildAndAdd() } }
        Log.i(TAG, "Region changed to $region, pool drained and rebuilding")
    }

    /**
     * Acquire a warm circuit from the pool.
     * Returns null if no healthy circuit is available (caller must build one inline).
     */
    fun acquireCircuit(): Circuit? {
        // Keep polling until we find a healthy circuit or the pool is empty
        while (true) {
            val circuit = pool.poll() ?: return null
            if (circuit.isAlive()) {
                circuit.requestCount.incrementAndGet()
                Log.v(TAG, "Acquired circuit ${circuit.ingress.host}->${circuit.egress.host} (#${circuit.requestCount.get()})")
                triggerRebuildIfNeeded()
                return circuit
            } else {
                runCatching { circuit.socket.close() }
                Log.d(TAG, "Discarded expired circuit from pool")
            }
        }
    }

    /**
     * Return a circuit to the pool if it's still healthy; otherwise close it.
     */
    fun releaseCircuit(circuit: Circuit) {
        if (circuit.isAlive() && pool.size < TARGET_POOL_SIZE * 2) {
            pool.offer(circuit)
        } else {
            runCatching { circuit.socket.close() }
        }
        triggerRebuildIfNeeded()
    }

    private fun triggerRebuildIfNeeded() {
        val needed = TARGET_POOL_SIZE - pool.count { it.isAlive() }
        if (needed > 0 && running.get()) {
            repeat(needed) { buildExecutor.submit { buildAndAdd() } }
        }
    }

    private fun rebuilderLoop() {
        while (running.get()) {
            try {
                Thread.sleep(15_000)
                // Evict expired circuits
                val expired = pool.filter { !it.isAlive() }
                expired.forEach { c -> pool.remove(c); runCatching { c.socket.close() } }
                // Fill pool if needed
                triggerRebuildIfNeeded()
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                break
            } catch (e: Exception) {
                Log.w(TAG, "Rebuilder loop error: ${e.message}")
            }
        }
    }

    private fun buildAndAdd() {
        if (!running.get()) return
        try {
            val circuit = buildCircuit(currentRegion) ?: return
            if (running.get()) {
                pool.offer(circuit)
                Log.i(TAG, "Pre-warmed circuit: ${circuit.ingress.host}:${circuit.ingress.port} -> ${circuit.egress.host}:${circuit.egress.port} [pool=${pool.size}]")
            } else {
                runCatching { circuit.socket.close() }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Circuit build failed: ${e.message}")
        }
    }

    private fun drainPool() {
        while (true) {
            val c = pool.poll() ?: break
            runCatching { c.socket.close() }
        }
    }

    // ---------------------------------------------------------------------------
    // Circuit construction: dual-hop SOCKS5 tunnel
    // ---------------------------------------------------------------------------
    fun buildCircuit(region: String): Circuit? {
        val egressCandidates = NodeRegistry.getNodesForRegion(region)
        if (egressCandidates.isEmpty()) {
            Log.w(TAG, "No egress candidates for region=$region")
            return null
        }
        val egress = egressCandidates.first()
        val ingressCandidates = NodeRegistry.getBestIngress(excludeHosts = setOf(egress.host))
        if (ingressCandidates.isEmpty()) {
            Log.w(TAG, "No ingress candidates available")
            return null
        }
        val ingress = ingressCandidates.first()
        return buildTunnel(ingress, egress)
    }

    fun buildCircuitTo(egress: FokkTunnelEngine.PrivacyNode): Circuit? {
        val ingressCandidates = NodeRegistry.getBestIngress(excludeHosts = setOf(egress.host))
        if (ingressCandidates.isEmpty()) return null
        val ingress = ingressCandidates.first()
        return buildTunnel(ingress, egress)
    }

    /**
     * Build a fully-handshaked ingress -> egress SOCKS5 tunnel socket.
     * The returned socket is positioned so the NEXT write to it goes to the egress
     * node's SOCKS5 layer, ready to issue a CONNECT to the final destination.
     */
    private fun buildTunnel(
        ingress: FokkTunnelEngine.PrivacyNode,
        egress: FokkTunnelEngine.PrivacyNode
    ): Circuit? {
        var sock: Socket? = null
        try {
            sock = Socket()
            sock.tcpNoDelay = true
            sock.sendBufferSize = 65536
            sock.receiveBufferSize = 65536
            sock.connect(InetSocketAddress(ingress.host, ingress.port), BUILD_TIMEOUT_MS)
            sock.soTimeout = 4_000

            val out = sock.getOutputStream()
            val inp = sock.getInputStream()

            // --- Hop 1: SOCKS5 handshake with Ingress Relay ---
            out.write(byteArrayOf(0x05, 0x01, 0x00))  // VER=5, 1 auth method: NO AUTH
            out.flush()
            val greet = ByteArray(2)
            readFully(inp, greet)
            if (greet[0] != 0x05.toByte() || greet[1] != 0x00.toByte()) {
                Log.w(TAG, "Ingress ${ingress.host} rejected SOCKS5 greeting")
                NodeRegistry.markDead(ingress)
                sock.close()
                return null
            }

            // --- Hop 1 -> Hop 2: Tell ingress to connect to egress ---
            val gwBytes = egress.host.toByteArray(StandardCharsets.ISO_8859_1)
            val hop1Req = ByteArray(4 + 1 + gwBytes.size + 2)
            hop1Req[0] = 0x05; hop1Req[1] = 0x01; hop1Req[2] = 0x00; hop1Req[3] = 0x03
            hop1Req[4] = gwBytes.size.toByte()
            System.arraycopy(gwBytes, 0, hop1Req, 5, gwBytes.size)
            hop1Req[hop1Req.size - 2] = (egress.port shr 8).toByte()
            hop1Req[hop1Req.size - 1] = (egress.port and 0xFF).toByte()
            out.write(hop1Req)
            out.flush()
            if (!readSocks5Reply(inp)) {
                Log.w(TAG, "Ingress ${ingress.host} could not reach egress ${egress.host}")
                NodeRegistry.markDead(ingress, 60_000L)
                sock.close()
                return null
            }

            // --- Hop 2: SOCKS5 handshake with Egress Node (through ingress tunnel) ---
            if (!egress.isHttpConnect) {
                out.write(byteArrayOf(0x05, 0x01, 0x00))
                out.flush()
                val egGreet = ByteArray(2)
                readFully(inp, egGreet)
                if (egGreet[0] != 0x05.toByte() || egGreet[1] != 0x00.toByte()) {
                    Log.w(TAG, "Egress ${egress.host} rejected SOCKS5 greeting")
                    NodeRegistry.markDead(egress)
                    sock.close()
                    return null
                }
            }

            // Circuit is established — ready to accept CONNECT commands
            sock.soTimeout = 30_000
            return Circuit(socket = sock, ingress = ingress, egress = egress)
        } catch (e: Exception) {
            Log.w(TAG, "buildTunnel ${ingress.host}->${egress.host} failed: ${e.message}")
            runCatching { sock?.close() }
            return null
        }
    }

    /**
     * Take a pre-warmed circuit and issue a CONNECT to the final destination.
     * Returns the socket ready for bidirectional data transfer, or null on failure.
     */
    fun connectCircuitTo(
        circuit: Circuit,
        targetHost: String,
        targetPort: Int
    ): Socket? {
        val out = circuit.socket.getOutputStream()
        val inp = circuit.socket.getInputStream()
        return try {
            if (circuit.egress.isHttpConnect) {
                // HTTP CONNECT to final target through egress
                val req = "CONNECT $targetHost:$targetPort HTTP/1.1\r\nHost: $targetHost:$targetPort\r\nProxy-Connection: Keep-Alive\r\n\r\n"
                out.write(req.toByteArray(StandardCharsets.ISO_8859_1))
                out.flush()
                val buf = ByteArray(1024)
                var n = 0
                while (n < buf.size) {
                    val b = inp.read()
                    if (b == -1) break
                    buf[n++] = b.toByte()
                    if (n >= 4 &&
                        buf[n-4] == '\r'.code.toByte() && buf[n-3] == '\n'.code.toByte() &&
                        buf[n-2] == '\r'.code.toByte() && buf[n-1] == '\n'.code.toByte()) break
                }
                val resp = String(buf, 0, n, StandardCharsets.ISO_8859_1)
                if (resp.contains("200")) circuit.socket else null
            } else {
                // SOCKS5 CONNECT to final target through egress
                val hostBytes = targetHost.toByteArray(StandardCharsets.ISO_8859_1)
                val req = ByteArray(4 + 1 + hostBytes.size + 2)
                req[0] = 0x05; req[1] = 0x01; req[2] = 0x00; req[3] = 0x03
                req[4] = hostBytes.size.toByte()
                System.arraycopy(hostBytes, 0, req, 5, hostBytes.size)
                req[req.size - 2] = (targetPort shr 8).toByte()
                req[req.size - 1] = (targetPort and 0xFF).toByte()
                out.write(req)
                out.flush()
                if (readSocks5Reply(inp)) circuit.socket else null
            }
        } catch (e: Exception) {
            Log.w(TAG, "connectCircuitTo $targetHost failed: ${e.message}")
            null
        }
    }

    // ---------------------------------------------------------------------------
    // SOCKS5 protocol helpers
    // ---------------------------------------------------------------------------
    private fun readFully(stream: java.io.InputStream, buf: ByteArray) {
        var offset = 0
        while (offset < buf.size) {
            val n = stream.read(buf, offset, buf.size - offset)
            if (n < 0) throw java.io.EOFException("EOF after $offset/${buf.size} bytes")
            offset += n
        }
    }

    private fun readSocks5Reply(stream: java.io.InputStream): Boolean {
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
