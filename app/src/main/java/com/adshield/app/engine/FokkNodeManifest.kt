package com.adshield.app.engine

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
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

/**
 * Fokk Mesh 3.0 Node Manifest — downloads, validates, and verifies the live
 * relay manifest published every 6 hours by Fokk Mesh Sentinel.
 *
 * Security & Reliability Guarantees:
 *   - Primary feed: dedicated `mesh-manifest` live branch + CDN release asset
 *     (never blocked by `main` PR branch protection).
 *   - 3-hour cache TTL + on-demand `forceRefresh()` self-healing when nodes fail.
 *   - Strict bogon/SSRF filter: rejects any loopback, RFC1918 private, link-local,
 *     or metadata IP so a tampered manifest can never pivot into the device/LAN.
 *   - Fail-closed Ed25519 signature verification once a production public key is set
 *     (never silently catches exceptions and returns true).
 */
object FokkNodeManifest {
    private const val TAG = "FokkNodeManifest"

    // Ordered manifest feeds: live Sentinel branch -> live release CDN -> main fallback
    private val MANIFEST_URLS = listOf(
        "https://raw.githubusercontent.com/Kimmojiraja/fokk-project/mesh-manifest/nodes_manifest.json",
        "https://github.com/Kimmojiraja/fokk-project/releases/download/mesh-manifest-live/nodes_manifest.json",
        "https://raw.githubusercontent.com/Kimmojiraja/fokk-project/main/nodes_manifest.json"
    )

    // 3-hour TTL aligned with 6-hour Sentinel refresh cadence
    private const val CACHE_TTL_MS = 3 * 60 * 60 * 1000L

    // Cooldown for forced self-healing refreshes (prevent hammer loops)
    private const val FORCE_REFRESH_COOLDOWN_MS = 60_000L

    // Replace with real Base64 DER-encoded Ed25519 public key once FOKK_MESH_ED25519_PRIVKEY is added to CI secrets
    private const val SIGNING_PUBLIC_KEY_B64 =
        "MCowBQYDK2VwAyEAFokkMeshPublicKeyPlaceholder000000000000000000000000="

    private fun isRealSigningKeyConfigured(): Boolean =
        !SIGNING_PUBLIC_KEY_B64.contains("Placeholder", ignoreCase = true)

    private val lock = ReentrantReadWriteLock()
    private var cachedNodes: List<FokkTunnelEngine.PrivacyNode> = emptyList()
    private var cachedIngress: List<FokkTunnelEngine.PrivacyNode> = emptyList()
    private val cacheExpiry = AtomicLong(0L)
    private val lastForceRefresh = AtomicLong(0L)
    @Volatile var lastIssuedAt: String = ""
        private set
    @Volatile var lastVerifiedSigned: Boolean = false
        private set
    private var fetchInProgress = false

    fun getNodes(): List<FokkTunnelEngine.PrivacyNode> = lock.read { cachedNodes }
    fun getIngressNodes(): List<FokkTunnelEngine.PrivacyNode> = lock.read { cachedIngress }

    /**
     * Fetch and verify the manifest in the background if TTL has expired.
     */
    fun refreshIfNeeded() {
        if (System.currentTimeMillis() < cacheExpiry.get() && cachedNodes.isNotEmpty()) return
        triggerFetchAsync()
    }

    /**
     * Immediate self-healing refresh triggered when runtime nodes are unreachable.
     */
    fun forceRefresh() {
        val now = System.currentTimeMillis()
        if (now - lastForceRefresh.get() < FORCE_REFRESH_COOLDOWN_MS) return
        lastForceRefresh.set(now)
        cacheExpiry.set(0L)
        triggerFetchAsync()
    }

    private fun triggerFetchAsync() {
        synchronized(this) {
            if (fetchInProgress) return
            fetchInProgress = true
        }
        Thread({
            try {
                fetchAndApply()
            } finally {
                synchronized(this) { fetchInProgress = false }
            }
        }, "fokk-manifest-fetch").apply {
            isDaemon = true
            start()
        }
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
                if (parseAndVerify(raw)) {
                    Log.i(TAG, "Loaded verified Fokk Mesh manifest from $urlStr")
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
     * Rejects loopback, RFC1918 private, link-local, multicast, or cloud-metadata IPs.
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

        // Check 172.16.0.0/12 and 100.64.0.0/10 (CGNAT)
        val parts = clean.split(".")
        if (parts.size == 4) {
            val a = parts[0].toIntOrNull() ?: return false
            val b = parts[1].toIntOrNull() ?: return false
            val c = parts[2].toIntOrNull() ?: return false
            val d = parts[3].toIntOrNull() ?: return false
            if (a !in 1..255 || b !in 0..255 || c !in 0..255 || d !in 0..255) return false
            if (a == 172 && b in 16..31) return false
            if (a == 100 && b in 64..127) return false
            if (a >= 224) return false // multicast / reserved
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

    private fun parseAndVerify(raw: String): Boolean {
        return try {
            val json = JSONObject(raw)
            val nodesArray = json.optJSONArray("nodes") ?: return false
            if (nodesArray.length() == 0) return false
            val signatureB64 = json.optString("signature", "").trim()

            // Verify Ed25519 signature strictly fail-closed when real public key is configured
            val sigVerified = verifySignature(nodesArray, signatureB64)
            if (!sigVerified) {
                Log.e(TAG, "Manifest signature verification FAILED — discarding untrusted payload")
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
            lastIssuedAt = json.optString("issued_at", "")
            lastVerifiedSigned = isRealSigningKeyConfigured() && json.optBoolean("signed", false)
            cacheExpiry.set(System.currentTimeMillis() + CACHE_TTL_MS)
            Log.i(TAG, "Manifest applied: ${nodes.size} safe nodes (${ingress.size} dual-hop ingress relays, issued=$lastIssuedAt)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Manifest parse error: ${e.message}")
            false
        }
    }

    private fun verifySignature(nodesArray: JSONArray, signatureB64: String): Boolean {
        if (!isRealSigningKeyConfigured()) {
            // Until production Ed25519 keypair is provisioned, rely on strict HTTPS origin + bogon/schema filter.
            return true
        }
        if (signatureB64.isBlank() || signatureB64.startsWith("PLACEHOLDER") || signatureB64.startsWith("UNSIGNED")) {
            return false
        }
        return try {
            val pubKeyBytes = Base64.decode(SIGNING_PUBLIC_KEY_B64, Base64.DEFAULT)
            val keySpec = X509EncodedKeySpec(pubKeyBytes)
            val kf = KeyFactory.getInstance("Ed25519")
            val pubKey = kf.generatePublic(keySpec)
            val sig = Signature.getInstance("Ed25519")
            sig.initVerify(pubKey)
            sig.update(nodesArray.toString().toByteArray(Charsets.UTF_8))
            val sigBytes = Base64.decode(signatureB64, Base64.DEFAULT)
            sig.verify(sigBytes)
        } catch (e: Exception) {
            // Strictly FAIL-CLOSED when production signing key is configured
            Log.e(TAG, "Ed25519 verification error (fail-closed): ${e.message}")
            false
        }
    }
}
