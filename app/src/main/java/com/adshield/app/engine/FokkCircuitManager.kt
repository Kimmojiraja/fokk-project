package com.adshield.app.engine

import android.util.Log
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Fokk Mesh 3.1 Circuit Manager — pre-warms fresh 2-hop circuits with full support for
 * RFC 1929 SOCKS5 authentication and TLS-over-SOCKS5 encrypted Hop-1 relays.
 */
object FokkCircuitManager {
    private const val TAG = "FokkCircuitManager"
    private const val TARGET_POOL_SIZE = 4
    private const val MAX_IDLE_POOL_AGE_MS = 25_000L
    private const val BUILD_CONNECT_TIMEOUT_MS = 5_500
    private const val BUILD_IO_TIMEOUT_MS = 6_000

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
            FokkNodeManifest.ensureLoadedBlocking(4_500L)
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
                if (attempts >= 3) return null
                attempts++
                val circuit = buildTunnel(ingress, egress)
                if (circuit != null) return circuit
            }
        }
        return null
    }

    /**
     * Build a fully-handshaked Ingress -> Egress tunnel socket supporting:
     *   - TLS-over-SOCKS5 on Hop 1 (`ingress.useTls`)
     *   - RFC 1929 SOCKS5 username/password auth on BOTH Hop 1 and Hop 2
     */
    private fun buildTunnel(
        ingress: FokkTunnelEngine.PrivacyNode,
        egress: FokkTunnelEngine.PrivacyNode
    ): Circuit? {
        var sock: Socket? = null
        try {
            sock = FokkTunnelEngine.openRelaySocket(ingress, BUILD_CONNECT_TIMEOUT_MS, BUILD_IO_TIMEOUT_MS)
            val out = sock.getOutputStream()
            val inp = sock.getInputStream()

            // Hop 1: SOCKS5 greeting + optional RFC 1929 auth with Ingress Relay
            if (!FokkTunnelEngine.performSocks5GreetingAndAuth(inp, out, ingress)) {
                NodeRegistry.markDead(ingress, 45_000L)
                sock.close()
                return null
            }

            // Hop 1 -> Hop 2: Ask Ingress to connect to Egress
            if (!FokkTunnelEngine.sendSocks5Connect(inp, out, egress.host, egress.port)) {
                NodeRegistry.markDead(ingress, 30_000L)
                sock.close()
                return null
            }

            // Hop 2: SOCKS5 greeting + optional RFC 1929 auth with Egress Relay (through Ingress tunnel)
            if (!egress.isHttpConnect) {
                if (!FokkTunnelEngine.performSocks5GreetingAndAuth(inp, out, egress)) {
                    NodeRegistry.markDead(egress, 45_000L)
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

    fun connectCircuitTo(
        circuit: Circuit,
        targetHost: String,
        targetPort: Int
    ): Socket? {
        return try {
            circuit.socket.soTimeout = 6_000
            val ok = if (circuit.egress.isHttpConnect) {
                FokkTunnelEngine.performHttpConnect(circuit.socket, targetHost, targetPort, circuit.egress)
            } else {
                FokkTunnelEngine.sendSocks5Connect(
                    circuit.socket.getInputStream(),
                    circuit.socket.getOutputStream(),
                    targetHost,
                    targetPort
                )
            }
            if (ok) {
                circuit.socket.soTimeout = 30_000
                circuit.socket
            } else null
        } catch (e: Exception) {
            Log.w(TAG, "connectCircuitTo $targetHost failed: ${e.message}")
            null
        }
    }
}
