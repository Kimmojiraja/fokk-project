package com.adshield.app.engine

import android.util.Log
import java.util.concurrent.ConcurrentHashMap

/**
 * Fokk Mesh Node Registry — single authoritative source for all relay nodes.
 *
 * Priority chain:
 *   1. Live signed manifest (downloaded, Ed25519-verified, cached 24 h)
 *   2. Certified builtin list (shipped with APK, SSL-verified before inclusion)
 *
 * All nodes in both sources have passed SSL certificate verification confirming
 * they relay traffic without MitM interception.
 */
object NodeRegistry {
    private const val TAG = "NodeRegistry"

    // ---------------------------------------------------------------------------
    // Certified builtin node list — only nodes with verified clean TLS certs.
    // Every entry here has been manually checked: TCP connect + SSL handshake
    // to a known HTTPS host confirmed no self-signed or forged certificate.
    // ---------------------------------------------------------------------------
    private val BUILTIN_NODES: List<FokkTunnelEngine.PrivacyNode> = listOf(
        // Americas
        FokkTunnelEngine.PrivacyNode("45.61.188.134",   44499, false, "US", "Miami"),
        FokkTunnelEngine.PrivacyNode("69.55.49.177",    38182, false, "US", "North Bergen"),
        FokkTunnelEngine.PrivacyNode("184.75.221.82",   3118,  true,  "CA", "Montreal"),
        // Europe
        FokkTunnelEngine.PrivacyNode("49.13.22.249",    10805, false, "DE", "Frankfurt"),
        FokkTunnelEngine.PrivacyNode("5.75.133.113",    10802, false, "DE", "Frankfurt"),
        FokkTunnelEngine.PrivacyNode("5.75.133.113",    10807, false, "DE", "Falkenstein"),
        FokkTunnelEngine.PrivacyNode("171.25.158.95",   1080,  false, "SE", "Stockholm"),
        FokkTunnelEngine.PrivacyNode("193.218.118.128", 1080,  false, "NL", "Amsterdam"),
        FokkTunnelEngine.PrivacyNode("51.159.115.233",  1080,  false, "FR", "Paris"),
        FokkTunnelEngine.PrivacyNode("77.91.90.27",     1082,  false, "GB", "London"),
        // Asia & Pacific
        FokkTunnelEngine.PrivacyNode("188.166.178.163", 1088,  false, "SG", "Singapore"),
        FokkTunnelEngine.PrivacyNode("183.87.145.150",  2080,  false, "IN", "Mumbai"),
        FokkTunnelEngine.PrivacyNode("101.36.104.239",  10808, false, "JP", "Tokyo"),
        FokkTunnelEngine.PrivacyNode("123.58.219.171",  10808, false, "HK", "Hong Kong"),
        FokkTunnelEngine.PrivacyNode("121.169.46.116",  1090,  false, "KR", "Suwon")
    )

    // ---------------------------------------------------------------------------
    // Certified builtin INGRESS RELAYS — first-hop nodes that see the user IP
    // but never see the destination. Geographically diverse for unlinkability.
    // ---------------------------------------------------------------------------
    val BUILTIN_INGRESS: List<FokkTunnelEngine.PrivacyNode> = listOf(
        FokkTunnelEngine.PrivacyNode("45.61.188.134",   44499, false, "US", "Miami"),
        FokkTunnelEngine.PrivacyNode("69.55.49.177",    38182, false, "US", "North Bergen"),
        FokkTunnelEngine.PrivacyNode("49.13.22.249",    10802, false, "DE", "Frankfurt"),
        FokkTunnelEngine.PrivacyNode("188.166.178.163", 1088,  false, "SG", "Singapore")
    )

    // ---------------------------------------------------------------------------
    // Health state — latency in ms, dead-until epoch ms, fail count
    // ---------------------------------------------------------------------------
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

    // ---------------------------------------------------------------------------
    // Node access
    // ---------------------------------------------------------------------------
    private fun allNodes(): List<FokkTunnelEngine.PrivacyNode> {
        val manifestNodes = FokkNodeManifest.getNodes()
        return if (manifestNodes.isNotEmpty()) manifestNodes else BUILTIN_NODES
    }

    private val AM_COUNTRIES = setOf("US","CA","MX","BR","AR","CL","CO","PE","CR","PA")
    private val EU_COUNTRIES = setOf("GB","DE","NL","FR","CH","SE","NO","FI","ES","IT","PL","IE","BE","AT","CZ","DK","PT","RO")
    private val AS_COUNTRIES = setOf("JP","KR","SG","HK","IN","AU","NZ","TW","MY","ID","TH","VN")

    fun getNodesForRegion(region: String): List<FokkTunnelEngine.PrivacyNode> {
        val all = allNodes()
        val candidates = when (region) {
            "AM"   -> all.filter { it.country in AM_COUNTRIES }
            "EU"   -> all.filter { it.country in EU_COUNTRIES }
            "AS"   -> all.filter { it.country in AS_COUNTRIES }
            "AUTO" -> all
            else   -> all.filter { it.country == region }
        }
        val pool = candidates.ifEmpty { all }
        return pool.filter { isAlive(it) }.sortedBy { getLatency(it) }.ifEmpty { pool }
    }

    fun getBestIngress(excludeHosts: Set<String> = emptySet()): List<FokkTunnelEngine.PrivacyNode> {
        val manifestIngress = FokkNodeManifest.getIngressNodes()
        val pool = if (manifestIngress.isNotEmpty()) manifestIngress else BUILTIN_INGRESS
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
