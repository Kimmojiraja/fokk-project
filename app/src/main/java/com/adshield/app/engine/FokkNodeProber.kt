package com.adshield.app.engine

import android.util.Log
import java.io.DataInputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Fokk Mesh 3.0 Node Prober — protocol-level parallel health & latency auditor.
 *
 * Unlike bare TCP connect checks (which falsely rank dead/walled-garden ports as alive),
 * this prober performs a real SOCKS5 handshake or HTTP CONNECT check on every relay,
 * marks failing relays dead immediately, and triggers self-healing manifest refresh
 * if all cached relays appear unreachable.
 */
object FokkNodeProber {
    private const val TAG = "FokkNodeProber"
    private const val PROBE_CONNECT_TIMEOUT_MS = 2_000
    private const val PROBE_IO_TIMEOUT_MS = 2_000
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
                val latency = future.get(4_500, TimeUnit.MILLISECONDS)
                if (latency >= 0) {
                    NodeRegistry.markAlive(node, latency)
                    alive++
                    if (latency < fastest) fastest = latency
                } else {
                    NodeRegistry.markDead(node, 180_000L)
                    dead++
                }
            } catch (_: Exception) {
                NodeRegistry.markDead(node, 180_000L)
                dead++
            }
        }

        lastAliveCount = alive
        bestLatencyMs = if (fastest == Long.MAX_VALUE) 0L else fastest
        Log.i(TAG, "Protocol probe complete: $alive/$lastTotalCount alive (fastest=${bestLatencyMs}ms), $dead dead")

        // Self-heal: if zero nodes responded, force-refresh live Sentinel manifest immediately
        if (alive == 0) {
            Log.w(TAG, "Zero live relays detected — triggering self-healing manifest refresh")
            FokkNodeManifest.forceRefresh()
        }
    }

    /**
     * Real protocol probe:
     *   - SOCKS5: TCP connect + 0x05 0x01 0x00 greeting -> verifies 0x05 0x00 reply
     *   - HTTP:   TCP connect + CONNECT api.ipify.org:443 -> verifies HTTP 200 status line
     * Returns RTT in ms on success, or -1 on failure.
     */
    private fun probeSingle(node: FokkTunnelEngine.PrivacyNode): Long {
        if (!FokkNodeManifest.isSafePublicRelayHost(node.host)) return -1L
        val t0 = System.currentTimeMillis()
        return try {
            Socket().use { s ->
                s.tcpNoDelay = true
                s.connect(InetSocketAddress(node.host, node.port), PROBE_CONNECT_TIMEOUT_MS)
                s.soTimeout = PROBE_IO_TIMEOUT_MS
                val out = s.getOutputStream()
                val inp = s.getInputStream()

                val ok = if (node.isHttpConnect) {
                    val req = "CONNECT api.ipify.org:443 HTTP/1.1\r\nHost: api.ipify.org:443\r\nProxy-Connection: Close\r\n\r\n"
                    out.write(req.toByteArray(StandardCharsets.ISO_8859_1))
                    out.flush()
                    val buf = ByteArray(128)
                    val n = inp.read(buf)
                    if (n > 0) {
                        val line = String(buf, 0, n, StandardCharsets.ISO_8859_1).substringBefore("\r\n")
                        line.startsWith("HTTP/") && line.contains(" 200")
                    } else {
                        false
                    }
                } else {
                    out.write(byteArrayOf(0x05, 0x01, 0x00))
                    out.flush()
                    val resp = ByteArray(2)
                    DataInputStream(inp).readFully(resp)
                    resp[0] == 0x05.toByte() && resp[1] == 0x00.toByte()
                }

                if (ok) (System.currentTimeMillis() - t0).coerceAtLeast(1L) else -1L
            }
        } catch (_: Exception) {
            -1L
        }
    }
}
