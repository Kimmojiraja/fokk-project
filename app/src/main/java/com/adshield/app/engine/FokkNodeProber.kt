package com.adshield.app.engine

import android.util.Log
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Fokk Mesh Node Prober — parallel latency prober for all registered relay nodes.
 *
 * Runs once when the mesh starts, and every 5 minutes thereafter.
 * Probes every node with a TCP connect attempt (1 500 ms timeout).
 * Results are written into NodeRegistry so the circuit manager can pick
 * the fastest live nodes for each new circuit.
 *
 * Dead nodes are marked with a 5-minute backoff; on retry they get a fresh chance.
 */
object FokkNodeProber {
    private const val TAG = "FokkNodeProber"
    private const val PROBE_TIMEOUT_MS = 1_500
    private const val PROBE_INTERVAL_MS = 5 * 60 * 1000L

    private val probePool: ExecutorService =
        Executors.newFixedThreadPool(8) { r ->
            Thread(r, "fokk-prober").also { it.isDaemon = true }
        }

    private var schedulerThread: Thread? = null
    private val running = AtomicBoolean(false)

    fun start() {
        if (!running.compareAndSet(false, true)) return
        schedulerThread = Thread({
            Log.i(TAG, "Prober started")
            while (running.get()) {
                probeAll()
                val deadline = System.currentTimeMillis() + PROBE_INTERVAL_MS
                while (running.get() && System.currentTimeMillis() < deadline) {
                    Thread.sleep(10_000)
                }
            }
            Log.i(TAG, "Prober stopped")
        }, "fokk-prober-scheduler").also { it.isDaemon = true; it.start() }
    }

    fun stop() {
        running.set(false)
        schedulerThread?.interrupt()
        schedulerThread = null
    }

    fun probeAll() {
        val nodes = NodeRegistry.getAllNodes()
        Log.d(TAG, "Probing ${nodes.size} nodes...")
        val futures = mutableListOf<Pair<FokkTunnelEngine.PrivacyNode, Future<Long>>>()
        for (node in nodes) {
            val future: Future<Long> = probePool.submit(Callable<Long> { probeSingle(node) })
            futures.add(node to future)
        }
        var alive = 0
        var dead = 0
        for ((node, future) in futures) {
            try {
                val latency = future.get(2_000, TimeUnit.MILLISECONDS)
                if (latency >= 0) {
                    NodeRegistry.markAlive(node, latency)
                    alive++
                } else {
                    NodeRegistry.markDead(node)
                    dead++
                }
            } catch (_: Exception) {
                NodeRegistry.markDead(node)
                dead++
            }
        }
        Log.i(TAG, "Probe complete: $alive alive, $dead dead")
    }

    /** Returns RTT in ms on success, -1 on failure. */
    private fun probeSingle(node: FokkTunnelEngine.PrivacyNode): Long {
        val t0 = System.currentTimeMillis()
        return try {
            Socket().use { s ->
                s.connect(InetSocketAddress(node.host, node.port), PROBE_TIMEOUT_MS)
            }
            val rtt = System.currentTimeMillis() - t0
            Log.v(TAG, "  ${node.host}:${node.port} alive ${rtt}ms")
            rtt
        } catch (_: Exception) {
            Log.v(TAG, "  ${node.host}:${node.port} dead")
            -1L
        }
    }
}
