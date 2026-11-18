package com.adshield.app.engine

import android.util.Log
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Fokk Mesh 3.1 Node Prober — protocol-level parallel health & latency auditor.
 *
 * Uses realistic global/mobile timeouts (5.5s connect, 5.5s handshake) so working
 * transoceanic relays are NEVER falsely killed, and supports both RFC 1929
 * username/password authentication and TLS-over-SOCKS5 relays.
 */
object FokkNodeProber {
    private const val TAG = "FokkNodeProber"
    private const val PROBE_CONNECT_TIMEOUT_MS = 5_500
    private const val PROBE_IO_TIMEOUT_MS = 5_500
    private const val PROBE_INTERVAL_MS = 3 * 60 * 1000L

    private val probePool: ExecutorService =
        Executors.newFixedThreadPool(8) { r ->
            Thread(r, "fokk-prober").also { it.isDaemon = true }
        }

    private var schedulerThread: Thread? = null
    private val running = AtomicBoolean(false)

    @Volatile var lastAliveCount: Int = 0
        private set
    @Volatile var lastTotalCount: Int = 0
        private set
    @Volatile var bestLatencyMs: Long = 0L
        private set

    fun start() {
        if (!running.compareAndSet(false, true)) return
        schedulerThread = Thread({
            Log.i(TAG, "Fokk Mesh protocol prober started")
            while (running.get()) {
                probeAll()
                val deadline = System.currentTimeMillis() + PROBE_INTERVAL_MS
                while (running.get() && System.currentTimeMillis() < deadline) {
                    try {
                        Thread.sleep(5_000)
                    } catch (_: InterruptedException) {
                        Thread.currentThread().interrupt()
                        break
                    }
                }
            }
            Log.i(TAG, "Fokk Mesh protocol prober stopped")
        }, "fokk-prober-scheduler").also { it.isDaemon = true; it.start() }
    }

    fun stop() {
        running.set(false)
        schedulerThread?.interrupt()
        schedulerThread = null
    }

    fun probeAll() {
        FokkNodeManifest.ensureLoadedBlocking(4_500L)
        val nodes = NodeRegistry.getAllNodes()
        lastTotalCount = nodes.size
        if (nodes.isEmpty()) return

        val futures = mutableListOf<Pair<FokkTunnelEngine.PrivacyNode, Future<Long>>>()
        for (node in nodes) {
            val future: Future<Long> = probePool.submit(Callable<Long> { probeSingle(node) })
            futures.add(node to future)
        }

        var alive = 0
        var dead = 0
        var fastest = Long.MAX_VALUE
        for ((node, future) in futures) {
            try {
                val latency = future.get(11_500, TimeUnit.MILLISECONDS)
                if (latency >= 0) {
                    NodeRegistry.markAlive(node, latency)
                    alive++
                    if (latency < fastest) fastest = latency
                } else {
                    // Short 45s cooldown so transient mobile hiccups recover quickly
                    NodeRegistry.markDead(node, 45_000L)
                    dead++
                }
            } catch (_: Exception) {
                NodeRegistry.markDead(node, 45_000L)
                dead++
            }
        }

        lastAliveCount = alive
        bestLatencyMs = if (fastest == Long.MAX_VALUE) 0L else fastest
        Log.i(TAG, "Protocol probe complete: $alive/$lastTotalCount alive (fastest=${bestLatencyMs}ms), $dead dead")

        if (alive == 0) {
            Log.w(TAG, "Zero live relays detected — triggering self-healing manifest refresh")
            FokkNodeManifest.forceRefresh()
        }
    }

    private fun probeSingle(node: FokkTunnelEngine.PrivacyNode): Long {
        if (!FokkNodeManifest.isSafePublicRelayHost(node.host)) return -1L
        val t0 = System.currentTimeMillis()
        var sock: java.net.Socket? = null
        return try {
            sock = FokkTunnelEngine.openRelaySocket(node, PROBE_CONNECT_TIMEOUT_MS, PROBE_IO_TIMEOUT_MS)
            val ok = if (node.isHttpConnect) {
                FokkTunnelEngine.performHttpConnect(sock, "api.ipify.org", 443, node)
            } else {
                FokkTunnelEngine.performSocks5GreetingAndAuth(sock.getInputStream(), sock.getOutputStream(), node)
            }
            if (ok) (System.currentTimeMillis() - t0).coerceAtLeast(1L) else -1L
        } catch (_: Exception) {
            -1L
        } finally {
            runCatching { sock?.close() }
        }
    }
}
