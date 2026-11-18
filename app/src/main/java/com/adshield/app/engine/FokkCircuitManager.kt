package com.adshield.app.engine

import android.util.Log
import java.io.EOFException
import java.io.InputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Fokk Mesh 3.0 Circuit Manager — maintains a fresh pool of pre-warmed 2-hop circuits.
 *
 * Dual-Hop Architecture:
 *   Browser -> Ingress Relay (Hop 1: knows client IP, routes only to Egress IP)
 *           -> Egress Relay  (Hop 2: knows destination, never sees client IP)
 *           -> Target Website
 *
 * Key Reliability Fixes (v3.0):
 *   - 25-second max idle pool lifetime (prevents silently-dropped half-open sockets
 *     that previously stalled requests when circuits sat idle for up to 10 minutes).
 *   - Multi-pair candidate iteration: tries up to 4 (ingress, egress) pairs instead
 *     of giving up after only the first node.
 *   - Strict non-colocation: guarantees ingress.host != egress.host and ingress is SOCKS5.
 */
object FokkCircuitManager {
    private const val TAG = "FokkCircuitManager"
    private const val TARGET_POOL_SIZE = 2
    private const val MAX_IDLE_POOL_AGE_MS = 25_000L // Keep idle pre-warmed sockets fresh
    private const val BUILD_TIMEOUT_MS = 3_500

    data class Circuit(
        val socket: Socket,
        val ingress: FokkTunnelEngine.PrivacyNode,
        val egress: FokkTunnelEngine.PrivacyNode,
        val createdAt: Long = System.currentTimeMillis(),
        val requestCount: AtomicInteger = AtomicInteger(0)
    ) {
        fun isExpired(): Boolean =
            System.currentTimeMillis() - createdAt > MAX_IDLE_POOL_AGE_MS

        fun isAlive(): Boolean =
            !socket.isClosed && socket.isConnected && !socket.isInputShutdown && !socket.isOutputShutdown && !isExpired()
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
            setRegion(region)
            return
        }
        Log.i(TAG, "Circuit manager started for region=$region")
        rebuilderExecutor.submit { rebuilderLoop() }
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
        if (running.get()) {
            repeat(TARGET_POOL_SIZE) { buildExecutor.submit { buildAndAdd() } }
        }
        Log.i(TAG, "Region changed to $region, pool drained and rebuilding")
    }

    /**
     * Acquire a fresh pre-warmed 2-hop circuit from the pool.
     * Automatically discards any expired or closed sockets.
     */
    fun acquireCircuit(): Circuit? {
        while (true) {
            val circuit = pool.poll() ?: return null
            if (circuit.isAlive()) {
                circuit.requestCount.incrementAndGet()
                triggerRebuildIfNeeded()
                return circuit
            } else {
                runCatching { circuit.socket.close() }
            }
        }
    }

    private fun triggerRebuildIfNeeded() {
        val aliveInPool = pool.count { it.isAlive() }
        val needed = TARGET_POOL_SIZE - aliveInPool
        if (needed > 0 && running.get()) {
            repeat(needed) { buildExecutor.submit { buildAndAdd() } }
        }
    }

    private fun rebuilderLoop() {
        while (running.get()) {
            try {
                Thread.sleep(8_000)
                val expired = pool.filter { !it.isAlive() }
                expired.forEach { c ->
                    pool.remove(c)
                    runCatching { c.socket.close() }
                }
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
                if (!pool.offer(circuit)) {
                    runCatching { circuit.socket.close() }
                } else {
                    Log.i(TAG, "Pre-warmed 2-hop circuit: ${circuit.ingress.host} -> ${circuit.egress.host} [pool=${pool.size}]")
                }
            } else {
                runCatching { circuit.socket.close() }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Circuit pre-warm failed: ${e.message}")
        }
    }

    private fun drainPool() {
        while (true) {
            val c = pool.poll() ?: break
            runCatching { c.socket.close() }
        }
    }

    /**
     * Build a fresh 2-hop circuit for the requested region, trying up to 4
     * distinct (ingress, egress) pairs before giving up.
     */
    fun buildCircuit(region: String, excludeEgressHosts: Set<String> = emptySet()): Circuit? {
        val egressCandidates = NodeRegistry.getNodesForRegion(region)
            .filter { it.host !in excludeEgressHosts && FokkNodeManifest.isSafePublicRelayHost(it.host) }
            .take(4)
        if (egressCandidates.isEmpty()) return null

        var attempts = 0
        for (egress in egressCandidates) {
            val ingressCandidates = NodeRegistry.getBestIngress(excludeHosts = setOf(egress.host))
                .filter { !it.isHttpConnect && FokkNodeManifest.isSafePublicRelayHost(it.host) }
                .take(2)
            for (ingress in ingressCandidates) {
                if (attempts >= 4) return null
                attempts++
                val circuit = buildTunnel(ingress, egress)
                if (circuit != null) return circuit
            }
        }
        return null
    }

    fun buildCircuitTo(egress: FokkTunnelEngine.PrivacyNode): Circuit? {
        if (!FokkNodeManifest.isSafePublicRelayHost(egress.host)) return null
        val ingressCandidates = NodeRegistry.getBestIngress(excludeHosts = setOf(egress.host))
            .filter { !it.isHttpConnect && FokkNodeManifest.isSafePublicRelayHost(it.host) }
            .take(2)
        for (ingress in ingressCandidates) {
            val circuit = buildTunnel(ingress, egress)
            if (circuit != null) return circuit
        }
        return null
    }

    /**
     * Construct a fully-handshaked Ingress -> Egress SOCKS5 tunnel socket.
     * Upon return, the socket is positioned directly at the Egress relay ready
     * to issue a CONNECT to the destination host.
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
            sock.soTimeout = 3_500

            val out = sock.getOutputStream()
            val inp = sock.getInputStream()

            // Hop 1: SOCKS5 greeting with Ingress Relay
            out.write(byteArrayOf(0x05, 0x01, 0x00))
            out.flush()
            val greet = ByteArray(2)
            readFully(inp, greet)
            if (greet[0] != 0x05.toByte() || greet[1] != 0x00.toByte()) {
                NodeRegistry.markDead(ingress, 120_000L)
                sock.close()
                return null
            }

            // Hop 1 -> Hop 2: Ask Ingress to connect to Egress
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
                NodeRegistry.markDead(ingress, 60_000L)
                sock.close()
                return null
            }

            // Hop 2: SOCKS5 greeting with Egress Relay (through Ingress tunnel)
            if (!egress.isHttpConnect) {
                out.write(byteArrayOf(0x05, 0x01, 0x00))
                out.flush()
                val egGreet = ByteArray(2)
                readFully(inp, egGreet)
                if (egGreet[0] != 0x05.toByte() || egGreet[1] != 0x00.toByte()) {
                    NodeRegistry.markDead(egress, 120_000L)
                    sock.close()
                    return null
                }
            }

            sock.soTimeout = 30_000
            return Circuit(socket = sock, ingress = ingress, egress = egress)
        } catch (e: Exception) {
            Log.w(TAG, "buildTunnel ${ingress.host}->${egress.host} failed: ${e.message}")
            runCatching { sock?.close() }
            return null
        }
    }

    /**
     * Issue a CONNECT command to the final destination through a pre-warmed 2-hop circuit.
     */
    fun connectCircuitTo(
        circuit: Circuit,
        targetHost: String,
        targetPort: Int
    ): Socket? {
        val out = circuit.socket.getOutputStream()
        val inp = circuit.socket.getInputStream()
        return try {
            circuit.socket.soTimeout = 4_500
            if (circuit.egress.isHttpConnect) {
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
                        buf[n - 4] == '\r'.code.toByte() && buf[n - 3] == '\n'.code.toByte() &&
                        buf[n - 2] == '\r'.code.toByte() && buf[n - 1] == '\n'.code.toByte()
                    ) break
                }
                val firstLine = String(buf, 0, n, StandardCharsets.ISO_8859_1).substringBefore("\r\n")
                if (firstLine.startsWith("HTTP/") && firstLine.contains(" 200")) {
                    circuit.socket.soTimeout = 30_000
                    circuit.socket
                } else null
            } else {
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
                    circuit.socket.soTimeout = 30_000
                    circuit.socket
                } else null
            }
        } catch (e: Exception) {
            Log.w(TAG, "connectCircuitTo $targetHost failed: ${e.message}")
            null
        }
    }

    private fun readFully(stream: InputStream, buf: ByteArray) {
        var offset = 0
        while (offset < buf.size) {
            val n = stream.read(buf, offset, buf.size - offset)
            if (n < 0) throw EOFException("EOF after $offset/${buf.size} bytes")
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
