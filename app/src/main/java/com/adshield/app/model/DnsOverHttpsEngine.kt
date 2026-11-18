package com.adshield.app.model

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/**
 * High-performance Encrypted DNS-over-HTTPS (DoH) & Threat Neutralization Resolver.
 * Bypasses local ISP domain blocking, censorship, and DNS tampering without a VPN.
 * Queries AdGuard, Control D, Mullvad, Cloudflare, or Quad9 via encrypted HTTPS with in-memory TTL caching.
 * Identifies DNS-level ad/tracker drops (0.0.0.0 / NXDOMAIN) for sub-millisecond filtering.
 */
class DnsOverHttpsEngine {

    companion object {
        private const val TAG = "FokkDoHEngine"
        const val PROVIDER_ADGUARD = "AdGuard Ad-Blocking (Default)"
        const val PROVIDER_NEXTDNS = "NextDNS Ad-Blocking"
        const val PROVIDER_CONTROLD = "Control D Ad-Blocking"
        const val PROVIDER_MULLVAD = "Mullvad Ad-Blocking"
        const val PROVIDER_CLOUDFLARE = "Cloudflare (1.1.1.1)"
        const val PROVIDER_QUAD9 = "Quad9 Malware Blocker (9.9.9.9)"
        const val PROVIDER_GOOGLE = "Google (8.8.8.8)"

        val ALL_PROVIDERS = arrayOf(
            PROVIDER_ADGUARD,
            PROVIDER_NEXTDNS,
            PROVIDER_CONTROLD,
            PROVIDER_MULLVAD,
            PROVIDER_CLOUDFLARE,
            PROVIDER_QUAD9,
            PROVIDER_GOOGLE
        )

        fun getProviderByName(name: String): Provider {
            return when (name) {
                PROVIDER_NEXTDNS -> Provider.NEXTDNS
                PROVIDER_CONTROLD -> Provider.CONTROLD
                PROVIDER_MULLVAD -> Provider.MULLVAD
                PROVIDER_CLOUDFLARE -> Provider.CLOUDFLARE
                PROVIDER_QUAD9 -> Provider.QUAD9
                PROVIDER_GOOGLE -> Provider.GOOGLE
                else -> Provider.ADGUARD
            }
        }
    }

    enum class Provider(val displayName: String, val endpoint: String, val isAdBlocking: Boolean) {
        ADGUARD(PROVIDER_ADGUARD, "https://dns.adguard-dns.com/dns-query", true),
        NEXTDNS(PROVIDER_NEXTDNS, "https://dns.nextdns.io/dns-query", true),
        CONTROLD(PROVIDER_CONTROLD, "https://freedns.controld.com/p0", true),
        MULLVAD(PROVIDER_MULLVAD, "https://adblock.doh.mullvad.net/dns-query", true),
        CLOUDFLARE(PROVIDER_CLOUDFLARE, "https://cloudflare-dns.com/dns-query", false),
        QUAD9(PROVIDER_QUAD9, "https://dns.quad9.net:5053/dns-query", false),
        GOOGLE(PROVIDER_GOOGLE, "https://dns.google/resolve", false)
    }

    private data class CacheEntry(
        val addresses: List<InetAddress>,
        val isBlocked: Boolean,
        val expiresAtMs: Long
    )

    private val cache = ConcurrentHashMap<String, CacheEntry>()
    private val knownBlockedHosts = ConcurrentHashMap.newKeySet<String>()

    var currentProvider: Provider = Provider.ADGUARD
    var isEnabled: Boolean = true

    /**
     * Fast, thread-safe check to determine if a host was determined to be an ad or tracker by DNS.
     */
    fun isKnownBlockedHost(host: String): Boolean {
        if (!isEnabled || host.isBlank()) return false
        val cleanHost = host.lowercase().trimEnd('.')
        if (knownBlockedHosts.contains(cleanHost)) return true

        // Check parent domains
        var dotIdx = cleanHost.indexOf('.')
        while (dotIdx != -1) {
            val parent = cleanHost.substring(dotIdx + 1)
            if (knownBlockedHosts.contains(parent)) return true
            dotIdx = cleanHost.indexOf('.', dotIdx + 1)
        }
        return false
    }

    /**
     * Synchronous, thread-safe, low-latency live DNS lookup used by WebView network filter.
     * Checks in-memory cache first (sub-millisecond). If not cached, queries DoH endpoint
     * (e.g. NextDNS / AdGuard) and caches the response.
     */
    fun isHostBlocked(host: String): Boolean {
        if (!isEnabled || !currentProvider.isAdBlocking || host.isBlank()) return false
        val cleanHost = host.lowercase().trimEnd('.')

        if (isKnownBlockedHost(cleanHost)) return true
        val cached = cache[cleanHost]
        if (cached != null) {
            if (System.currentTimeMillis() < cached.expiresAtMs) {
                return cached.isBlocked
            }
        }

        if (cleanHost == "localhost" || cleanHost.endsWith(".local") || cleanHost.endsWith(".internal")) {
            return false
        }

        return try {
            val queryUrl = "${currentProvider.endpoint}?name=${cleanHost}&type=A"
            val url = URL(queryUrl)
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 1200
                readTimeout = 1200
                setRequestProperty("Accept", "application/dns-json")
                setRequestProperty("User-Agent", "FokkShield/1.0")
            }

            if (conn.responseCode == 200) {
                val responseStr = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                val json = JSONObject(responseStr)
                val status = json.optInt("Status", -1)

                // NXDOMAIN (status 3) on ad-blocking resolver indicates domain blocked
                if (status == 3) {
                    knownBlockedHosts.add(cleanHost)
                    cache[cleanHost] = CacheEntry(emptyList(), isBlocked = true, System.currentTimeMillis() + 3600000L)
                    return true
                }

                if (status == 0 && json.has("Answer")) {
                    val answers = json.getJSONArray("Answer")
                    var hasSinkholeIp = false
                    val result = mutableListOf<InetAddress>()
                    var minTtl = 300L

                    for (i in 0 until answers.length()) {
                        val record = answers.getJSONObject(i)
                        val type = record.optInt("type", 1)
                        if (type == 1) {
                            val ip = record.optString("data", "").trim()
                            val ttl = record.optLong("TTL", 300L)
                            if (ttl < minTtl) minTtl = ttl
                            if (ip == "0.0.0.0" || ip == "127.0.0.1" || ip == "::") {
                                hasSinkholeIp = true
                            } else if (ip.isNotEmpty()) {
                                runCatching { result.add(InetAddress.getByName(ip)) }
                            }
                        }
                    }

                    if (hasSinkholeIp) {
                        knownBlockedHosts.add(cleanHost)
                        val ttlMs = (minTtl.coerceAtLeast(300L) * 1000L)
                        cache[cleanHost] = CacheEntry(emptyList(), isBlocked = true, System.currentTimeMillis() + ttlMs)
                        return true
                    }

                    val ttlMs = (minTtl.coerceAtLeast(60L) * 1000L)
                    cache[cleanHost] = CacheEntry(result, isBlocked = false, System.currentTimeMillis() + ttlMs)
                    return false
                }
            }
            false
        } catch (e: Exception) {
            false
        }
    }

    suspend fun resolve(host: String): List<InetAddress> = withContext(Dispatchers.IO) {
        if (!isEnabled || host.isBlank()) {
            return@withContext runCatching { InetAddress.getAllByName(host).toList() }.getOrDefault(emptyList())
        }

        val cleanHost = host.lowercase().trimEnd('.')
        val cached = cache[cleanHost]
        if (cached != null && System.currentTimeMillis() < cached.expiresAtMs) {
            return@withContext cached.addresses
        }

        try {
            val queryUrl = "${currentProvider.endpoint}?name=${cleanHost}&type=A"
            val url = URL(queryUrl)
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 2500
                readTimeout = 2500
                setRequestProperty("Accept", "application/dns-json")
                setRequestProperty("User-Agent", "FokkShield/1.0")
            }

            if (conn.responseCode == 200) {
                val responseStr = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                val json = JSONObject(responseStr)
                val status = json.optInt("Status", -1)

                // AdGuard / Control D NXDOMAIN (Status 3) on ad-blocking resolvers denotes blocked ad domain
                if (status == 3 && currentProvider.isAdBlocking) {
                    knownBlockedHosts.add(cleanHost)
                    cache[cleanHost] = CacheEntry(emptyList(), isBlocked = true, System.currentTimeMillis() + 3600000L)
                    return@withContext emptyList()
                }

                if (status == 0 && json.has("Answer")) {
                    val answers = json.getJSONArray("Answer")
                    val result = mutableListOf<InetAddress>()
                    var minTtl = 300L
                    var hasSinkholeIp = false

                    for (i in 0 until answers.length()) {
                        val record = answers.getJSONObject(i)
                        val type = record.optInt("type", 1)
                        if (type == 1) { // Type A (IPv4)
                            val ip = record.optString("data", "").trim()
                            val ttl = record.optLong("TTL", 300L)
                            if (ttl < minTtl) minTtl = ttl
                            if (ip == "0.0.0.0" || ip == "127.0.0.1" || ip == "::") {
                                hasSinkholeIp = true
                            } else if (ip.isNotEmpty()) {
                                runCatching {
                                    result.add(InetAddress.getByName(ip))
                                }
                            }
                        }
                    }

                    if (hasSinkholeIp) {
                        knownBlockedHosts.add(cleanHost)
                        val ttlMs = (minTtl.coerceAtLeast(300L) * 1000L)
                        cache[cleanHost] = CacheEntry(emptyList(), isBlocked = true, System.currentTimeMillis() + ttlMs)
                        return@withContext emptyList()
                    }

                    if (result.isNotEmpty()) {
                        val ttlMs = (minTtl.coerceAtLeast(60L) * 1000L)
                        cache[cleanHost] = CacheEntry(result, isBlocked = false, System.currentTimeMillis() + ttlMs)
                        return@withContext result
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "DoH lookup failed for $cleanHost, falling back to system DNS: ${e.message}")
        }

        // Fallback to system DNS
        val fallback = runCatching { InetAddress.getAllByName(cleanHost).toList() }.getOrDefault(emptyList())
        if (fallback.isNotEmpty()) {
            cache[cleanHost] = CacheEntry(fallback, isBlocked = false, System.currentTimeMillis() + 60000L)
        }
        fallback
    }

    /**
     * Fast synchronous encrypted DoH resolver used by Fokk Smart-Cloak inside FokkTunnelEngine.
     * - Checks sub-ms in-memory TTL cache first.
     * - Queries the active DoH provider (AdGuard, Mullvad, NextDNS, Cloudflare, etc.) via HTTPS JSON API.
     * - Falls back to Cloudflare 1.1.1.1 DoH (direct IP, zero plaintext DNS needed!) if primary DoH fails.
     * - Returns emptyList() if the ad-blocking DoH provider explicitly sinkholed/blocked the domain.
     */
    fun resolveSync(host: String): List<InetAddress> {
        val cleanHost = host.lowercase().trimEnd('.')
        if (cleanHost.isBlank()) return emptyList()

        // Already an IP literal? Return directly without DNS lookup.
        if (cleanHost.matches(Regex("""^\d{1,3}(\.\d{1,3}){3}$""")) || cleanHost.contains(":")) {
            return runCatching { listOf(InetAddress.getByName(cleanHost)) }.getOrDefault(emptyList())
        }

        val cached = cache[cleanHost]
        if (cached != null && System.currentTimeMillis() < cached.expiresAtMs) {
            return if (cached.isBlocked) emptyList() else cached.addresses
        }

        // Ordered encrypted DoH endpoints: active provider first, then direct-IP Cloudflare 1.1.1.1 DoH
        val endpoints = buildList {
            if (isEnabled) add(currentProvider.endpoint to currentProvider.isAdBlocking)
            if (currentProvider != Provider.CLOUDFLARE) {
                add("https://1.1.1.1/dns-query" to false)
            }
        }

        for ((endpoint, isAdBlocking) in endpoints) {
            var conn: HttpURLConnection? = null
            try {
                val url = URL("$endpoint?name=$cleanHost&type=A")
                conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 2_000
                    readTimeout = 2_000
                    setRequestProperty("Accept", "application/dns-json")
                    setRequestProperty("User-Agent", "FokkSmartCloak/3.2")
                }
                if (conn.responseCode == 200) {
                    val responseStr = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                    val json = JSONObject(responseStr)
                    val status = json.optInt("Status", -1)

                    if (status == 3 && isAdBlocking) {
                        knownBlockedHosts.add(cleanHost)
                        cache[cleanHost] = CacheEntry(emptyList(), isBlocked = true, System.currentTimeMillis() + 3600_000L)
                        return emptyList()
                    }

                    if (status == 0 && json.has("Answer")) {
                        val answers = json.getJSONArray("Answer")
                        val result = mutableListOf<InetAddress>()
                        var minTtl = 300L
                        var hasSinkhole = false

                        for (i in 0 until answers.length()) {
                            val rec = answers.getJSONObject(i)
                            if (rec.optInt("type", 1) == 1) {
                                val ip = rec.optString("data", "").trim()
                                val ttl = rec.optLong("TTL", 300L)
                                if (ttl < minTtl) minTtl = ttl
                                if (ip == "0.0.0.0" || ip == "127.0.0.1" || ip == "::") {
                                    hasSinkhole = true
                                } else if (ip.isNotEmpty()) {
                                    runCatching { result.add(InetAddress.getByName(ip)) }
                                }
                            }
                        }

                        if (hasSinkhole) {
                            knownBlockedHosts.add(cleanHost)
                            cache[cleanHost] = CacheEntry(emptyList(), isBlocked = true, System.currentTimeMillis() + minTtl.coerceAtLeast(300L) * 1000L)
                            return emptyList()
                        }

                        if (result.isNotEmpty()) {
                            cache[cleanHost] = CacheEntry(result, isBlocked = false, System.currentTimeMillis() + minTtl.coerceAtLeast(60L) * 1000L)
                            return result
                        }
                    }
                }
            } catch (_: Exception) {
            } finally {
                runCatching { conn?.disconnect() }
            }
        }

        // Last-resort system DNS fallback only if all encrypted DoH servers are unreachable
        val fallback = runCatching { InetAddress.getAllByName(cleanHost).toList() }.getOrDefault(emptyList())
        if (fallback.isNotEmpty()) {
            cache[cleanHost] = CacheEntry(fallback, isBlocked = false, System.currentTimeMillis() + 60_000L)
        }
        return fallback
    }

    fun clearCache() {
        cache.clear()
        knownBlockedHosts.clear()
    }
}
