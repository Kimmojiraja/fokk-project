package com.adshield.app.engine

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.URL
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

/**
 * Fokk Mesh 3.0 Live Node Manifest — ZERO hardcoded relay IPs in the binary.
 *
 * Architecture:
 *   - Loads the last verified manifest from local SharedPreferences disk cache immediately on boot.
 *   - Refreshes automatically from the 6-hour Sentinel feeds (`mesh-manifest` live branch,
 *     `mesh-manifest-live` CDN release, and `main` fallback) every 3 hours or on self-healing trigger.
 *   - Rejects any private/loopback/link-local/CGNAT/reserved IP (bogon & SSRF guard).
 *   - Verifies a deterministic cross-platform canonical payload via Ed25519 (strictly fail-closed
 *     once a production public key is provisioned).
 */
object FokkNodeManifest {
    private const val TAG = "FokkNodeManifest"
    private const val PREFS_CACHE = "fokk_mesh_manifest_cache"
    private const val KEY_CACHED_RAW_JSON = "cached_manifest_raw_json"

    private val MANIFEST_URLS = listOf(
        "https://raw.githubusercontent.com/Kimmojiraja/fokk-project/mesh-manifest/nodes_manifest.json",
        "https://github.com/Kimmojiraja/fokk-project/releases/download/mesh-manifest-live/nodes_manifest.json",
        "https://raw.githubusercontent.com/Kimmojiraja/fokk-project/main/nodes_manifest.json"
    )

    private const val CACHE_TTL_MS = 3 * 60 * 60 * 1000L
    private const val FORCE_REFRESH_COOLDOWN_MS = 60_000L

    // Generate production keypair via: python3 scripts/sentinel_node_scanner.py --gen-key
    // Store private key in GitHub Secret FOKK_MESH_ED25519_PRIVKEY and paste DER public key below.
    private const val SIGNING_PUBLIC_KEY_B64 =
        "MCowBQYDK2VwAyEAFokkMeshPublicKeyPlaceholder000000000000000000000000="

    private fun isRealSigningKeyConfigured(): Boolean =
        !SIGNING_PUBLIC_KEY_B64.contains("Placeholder", ignoreCase = true)

    private val lock = ReentrantReadWriteLock()
    private var appPrefs: SharedPreferences? = null
    private var cachedNodes: List<FokkTunnelEngine.PrivacyNode> = emptyList()
    private var cachedIngress: List<FokkTunnelEngine.PrivacyNode> = emptyList()
    private val cacheExpiry = AtomicLong(0L)
    private val lastForceRefresh = AtomicLong(0L)

    @Volatile var lastIssuedAt: String = ""
        private set
    @Volatile var lastVerifiedSigned: Boolean = false
        private set

    private var fetchInProgress = false
    @Volatile private var activeFetchLatch: CountDownLatch? = null

    fun init(context: Context) {
        if (appPrefs == null) {
            appPrefs = context.applicationContext.getSharedPreferences(PREFS_CACHE, Context.MODE_PRIVATE)
            // Warm from last verified on-disk manifest immediately (zero hardcoded IPs)
            val savedRaw = appPrefs?.getString(KEY_CACHED_RAW_JSON, null)
            if (!savedRaw.isNullOrBlank() && cachedNodes.isEmpty()) {
                if (parseAndVerify(savedRaw, persistToDisk = false)) {
                    // Keep expiry at 0 so a fresh background sync still runs on startup
                    cacheExpiry.set(0L)
                    Log.i(TAG, "Restored ${cachedNodes.size} cached relays from local disk")
                }
            }
        }
        refreshIfNeeded()
    }

    fun getNodes(): List<FokkTunnelEngine.PrivacyNode> = lock.read { cachedNodes }
    fun getIngressNodes(): List<FokkTunnelEngine.PrivacyNode> = lock.read { cachedIngress }

    fun refreshIfNeeded() {
        if (System.currentTimeMillis() < cacheExpiry.get() && cachedNodes.isNotEmpty()) return
        triggerFetchAsync()
    }

    /**
     * On first-ever launch (before any disk cache exists), waits briefly for the
     * live Sentinel manifest fetch so circuits have live relays right away.
     */
    fun ensureLoadedBlocking(timeoutMs: Long = 3_500L) {
        if (cachedNodes.isNotEmpty()) {
            refreshIfNeeded()
            return
        }
        val latch = triggerFetchAsync()
        runCatching { latch?.await(timeoutMs, TimeUnit.MILLISECONDS) }
    }

    fun forceRefresh() {
        val now = System.currentTimeMillis()
        if (now - lastForceRefresh.get() < FORCE_REFRESH_COOLDOWN_MS) return
        lastForceRefresh.set(now)
        cacheExpiry.set(0L)
        triggerFetchAsync()
    }

    private fun triggerFetchAsync(): CountDownLatch? {
        val latch: CountDownLatch
        synchronized(this) {
            if (fetchInProgress) return activeFetchLatch
            fetchInProgress = true
            latch = CountDownLatch(1)
            activeFetchLatch = latch
        }
        Thread({
            try {
                fetchAndApply()
            } finally {
                synchronized(this) {
                    fetchInProgress = false
                    activeFetchLatch = null
                }
                latch.countDown()
            }
        }, "fokk-manifest-fetch").apply {
            isDaemon = true
            start()
        }
        return latch
    }

    private fun fetchAndApply() {
        for (urlStr in MANIFEST_URLS) {
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 6_000
                    readTimeout = 8_000
                    instanceFollowRedirects = true
                    setRequestProperty("User-Agent", "FokkMesh/3.0")
                    setRequestProperty("Cache-Control", "no-cache")
                }
                if (conn.responseCode != 200) {
                    Log.w(TAG, "Manifest feed $urlStr returned HTTP ${conn.responseCode}")
                    continue
                }
                val raw = conn.inputStream.bufferedReader().use { it.readText() }
                if (parseAndVerify(raw, persistToDisk = true)) {
                    Log.i(TAG, "Loaded live Fokk Mesh manifest from $urlStr")
                    return
                }
            } catch (e: Exception) {
                Log.w(TAG, "Manifest feed $urlStr failed: ${e.message}")
            } finally {
                runCatching { conn?.disconnect() }
            }
        }
    }

    /**
     * Rejects loopback, RFC1918 private, link-local, CGNAT, multicast, or metadata IPs.
     */
    fun isSafePublicRelayHost(host: String): Boolean {
        val clean = host.trim().lowercase()
        if (clean.isBlank() || clean == "localhost" || clean == "0.0.0.0") return false
        if (clean.startsWith("127.") ||
            clean.startsWith("10.") ||
            clean.startsWith("192.168.") ||
            clean.startsWith("169.254.") ||
            clean.startsWith("0.") ||
            clean == "::1"
        ) return false

        val parts = clean.split(".")
        if (parts.size == 4) {
            val a = parts[0].toIntOrNull() ?: return false
            val b = parts[1].toIntOrNull() ?: return false
            val c = parts[2].toIntOrNull() ?: return false
            val d = parts[3].toIntOrNull() ?: return false
            if (a !in 1..255 || b !in 0..255 || c !in 0..255 || d !in 0..255) return false
            if (a == 172 && b in 16..31) return false
            if (a == 100 && b in 64..127) return false
            if (a >= 224) return false
            return true
        }

        return try {
            val addr = InetAddress.getByName(clean)
            !(addr.isAnyLocalAddress || addr.isLoopbackAddress || addr.isLinkLocalAddress ||
              addr.isSiteLocalAddress || addr.isMulticastAddress)
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Cross-platform deterministic canonical signing payload (identical across Python, Kotlin, and Node.js):
     *   v2|<issued_at>|<host>:<port>:<type>:<country>:<1|0>;...
     */
    private fun buildCanonicalPayload(issuedAt: String, nodesArray: JSONArray): String {
        val entries = mutableListOf<String>()
        for (i in 0 until nodesArray.length()) {
            val n = nodesArray.optJSONObject(i) ?: continue
            val host = n.optString("host", "").trim()
            val port = n.optInt("port", -1)
            val type = if (n.optString("type", "socks5").equals("http", ignoreCase = true)) "http" else "socks5"
            val country = n.optString("country", "").trim().uppercase()
            val ingressFlag = if (n.optBoolean("ingress_relay", false)) "1" else "0"
            entries.add("$host:$port:$type:$country:$ingressFlag")
        }
        return "v2|$issuedAt|${entries.joinToString(";")}"
    }

    private fun parseAndVerify(raw: String, persistToDisk: Boolean): Boolean {
        return try {
            val json = JSONObject(raw)
            val nodesArray = json.optJSONArray("nodes") ?: return false
            if (nodesArray.length() == 0) return false
            val issuedAt = json.optString("issued_at", "").trim()
            val signatureB64 = json.optString("signature", "").trim()

            if (!verifySignature(issuedAt, nodesArray, signatureB64)) {
                Log.e(TAG, "Manifest Ed25519 signature verification FAILED — discarding untrusted payload")
                return false
            }

            val nodes = mutableListOf<FokkTunnelEngine.PrivacyNode>()
            val ingress = mutableListOf<FokkTunnelEngine.PrivacyNode>()
            for (i in 0 until nodesArray.length()) {
                val n = nodesArray.optJSONObject(i) ?: continue
                val host = n.optString("host", "").trim()
                val port = n.optInt("port", -1)
                if (port !in 1..65535 || !isSafePublicRelayHost(host)) {
                    Log.w(TAG, "Skipping unsafe relay entry: $host:$port")
                    continue
                }
                val country = n.optString("country", "").trim().uppercase()
                val city = n.optString("city", "").trim()
                val isHttp = n.optString("type", "socks5").equals("http", ignoreCase = true)
                val isIngressRelay = n.optBoolean("ingress_relay", false) && !isHttp
                val node = FokkTunnelEngine.PrivacyNode(host, port, isHttp, country, city)
                nodes.add(node)
                if (isIngressRelay) ingress.add(node)
            }

            if (nodes.isEmpty()) return false

            lock.write {
                cachedNodes = nodes
                cachedIngress = ingress
            }
            lastIssuedAt = issuedAt
            lastVerifiedSigned = isRealSigningKeyConfigured() && json.optBoolean("signed", false)
            if (persistToDisk) {
                cacheExpiry.set(System.currentTimeMillis() + CACHE_TTL_MS)
                runCatching {
                    appPrefs?.edit()?.putString(KEY_CACHED_RAW_JSON, raw)?.apply()
                }
            }
            Log.i(TAG, "Manifest applied: ${nodes.size} safe relays (${ingress.size} dual-hop ingress, issued=$lastIssuedAt)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Manifest parse error: ${e.message}")
            false
        }
    }

    private fun verifySignature(issuedAt: String, nodesArray: JSONArray, signatureB64: String): Boolean {
        if (!isRealSigningKeyConfigured()) {
            return true
        }
        if (signatureB64.isBlank() || signatureB64.startsWith("PLACEHOLDER") || signatureB64.startsWith("UNSIGNED")) {
            return false
        }
        return try {
            val canonicalBytes = buildCanonicalPayload(issuedAt, nodesArray).toByteArray(Charsets.UTF_8)
            val pubKeyBytes = Base64.decode(SIGNING_PUBLIC_KEY_B64, Base64.DEFAULT)
            val keySpec = X509EncodedKeySpec(pubKeyBytes)
            val kf = KeyFactory.getInstance("Ed25519")
            val pubKey = kf.generatePublic(keySpec)
            val sig = Signature.getInstance("Ed25519")
            sig.initVerify(pubKey)
            sig.update(canonicalBytes)
            val sigBytes = Base64.decode(signatureB64, Base64.DEFAULT)
            sig.verify(sigBytes)
        } catch (e: Exception) {
            Log.e(TAG, "Ed25519 verification error (fail-closed): ${e.message}")
            false
        }
    }
}
