package com.adshield.app.engine

import android.util.Log
import java.util.concurrent.ConcurrentHashMap

/**
 * Fokk Mesh 3.0 Node Registry — 100% live manifest + local disk cache driven.
 *
 * ZERO hardcoded relay IPs are embedded in the APK.
 * All relay entries come exclusively from the Sentinel-verified live manifest
 * (or the last verified manifest persisted locally on disk).
 */
object NodeRegistry {
    private const val TAG = "NodeRegistry"

    data class NodeHealth(
        val latencyMs: Long = Long.MAX_VALUE,
        val deadUntil: Long = 0L,
        val failCount: Int = 0
    )

    private val healthMap = ConcurrentHashMap<String, NodeHealth>()

    private fun nodeKey(node: FokkTunnelEngine.PrivacyNode) = "${node.host}:${node.port}"

    fun markAlive(node: FokkTunnelEngine.PrivacyNode, latencyMs: Long) {
        healthMap[nodeKey(node)] = NodeHealth(latencyMs = latencyMs, deadUntil = 0L, failCount = 0)
    }

    fun markDead(node: FokkTunnelEngine.PrivacyNode, durationMs: Long = 300_000L) {
        val existing = healthMap[nodeKey(node)]
        val failCount = (existing?.failCount ?: 0) + 1
        healthMap[nodeKey(node)] = NodeHealth(
            latencyMs = Long.MAX_VALUE,
            deadUntil = System.currentTimeMillis() + durationMs,
            failCount = failCount
        )
        Log.d(TAG, "Node ${node.host}:${node.port} dead for ${durationMs / 1000}s (fail #$failCount)")
    }

    fun isAlive(node: FokkTunnelEngine.PrivacyNode): Boolean {
        val h = healthMap[nodeKey(node)] ?: return true
        return System.currentTimeMillis() > h.deadUntil
    }

    fun getLatency(node: FokkTunnelEngine.PrivacyNode): Long =
        healthMap[nodeKey(node)]?.latencyMs ?: Long.MAX_VALUE

    private fun allNodes(): List<FokkTunnelEngine.PrivacyNode> = FokkNodeManifest.getNodes()

    private val AM_COUNTRIES = setOf("US", "CA", "MX", "BR", "AR", "CL", "CO", "PE", "CR", "PA")
    private val EU_COUNTRIES = setOf("GB", "DE", "NL", "FR", "CH", "SE", "NO", "FI", "ES", "IT", "PL", "IE", "BE", "AT", "CZ", "DK", "PT", "RO")
    private val AS_COUNTRIES = setOf("JP", "KR", "SG", "HK", "IN", "AU", "NZ", "TW", "MY", "ID", "TH", "VN")

    fun getNodesForRegion(region: String): List<FokkTunnelEngine.PrivacyNode> {
        val all = allNodes()
        if (all.isEmpty()) return emptyList()
        val candidates = when (region) {
            "AM"   -> all.filter { it.country in AM_COUNTRIES }
            "EU"   -> all.filter { it.country in EU_COUNTRIES }
            "AS"   -> all.filter { it.country in AS_COUNTRIES }
            "AUTO" -> all
            else   -> all.filter { it.country == region }
        }
        val pool = candidates.ifEmpty {
            val cont = continentOf(region)
            val contPool = when (cont) {
                "AM" -> all.filter { it.country in AM_COUNTRIES }
                "EU" -> all.filter { it.country in EU_COUNTRIES }
                "AS" -> all.filter { it.country in AS_COUNTRIES }
                else -> all
            }
            contPool.ifEmpty { all }
        }
        return pool.filter { isAlive(it) }.sortedBy { getLatency(it) }.ifEmpty { pool }
    }

    fun getBestIngress(excludeHosts: Set<String> = emptySet()): List<FokkTunnelEngine.PrivacyNode> {
        val manifestIngress = FokkNodeManifest.getIngressNodes()
        val pool = if (manifestIngress.isNotEmpty()) {
            manifestIngress
        } else {
            allNodes().filter { !it.isHttpConnect }
        }
        if (pool.isEmpty()) return emptyList()
        val alive = pool.filter { it.host !in excludeHosts && isAlive(it) }.sortedBy { getLatency(it) }
        return alive.ifEmpty { pool.filter { it.host !in excludeHosts }.ifEmpty { pool } }
    }

    fun getAllNodes(): List<FokkTunnelEngine.PrivacyNode> = allNodes()

    fun continentOf(countryCode: String): String = when {
        countryCode in AM_COUNTRIES -> "AM"
        countryCode in EU_COUNTRIES -> "EU"
        countryCode in AS_COUNTRIES -> "AS"
        else -> "AUTO"
    }
}
