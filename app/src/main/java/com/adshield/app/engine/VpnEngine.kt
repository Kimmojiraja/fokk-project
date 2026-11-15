package com.adshield.app.engine

import android.content.Context
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URI
import java.util.concurrent.Executors

/**
 * Privacy gateway for Fokk's WebViews.
 *
 * AndroidX ProxyController applies to this application's WebView traffic. It is
 * intentionally described as a browser proxy rather than a device-wide VPN:
 * a real system VPN also needs a user-provided tunnel endpoint and VpnService.
 * This gateway never adds a direct fallback after a proxy is enabled.
 */
object VpnEngine {
    const val PREFS_VPN = "fokk_vpn_settings"
    const val KEY_VPN_MODE = "vpn_mode"
    const val KEY_CUSTOM_PROXY = "vpn_custom_proxy"

    enum class VpnMode(val id: String, val title: String, val proxyUrl: String) {
        OFF("off", "Direct Connection (Privacy Gateway Disabled)", ""),
        CUSTOM("custom", "Custom SOCKS / HTTP Privacy Proxy", "")
    }

    private val executor = Executors.newSingleThreadExecutor()

    fun isSupported(): Boolean = WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)

    fun getActiveMode(context: Context): VpnMode {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        val id = prefs.getString(KEY_VPN_MODE, VpnMode.OFF.id) ?: VpnMode.OFF.id
        // Migrate the obsolete external-proxy mode to Direct.
        if (id == "tor") {
            prefs.edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).apply()
            return VpnMode.OFF
        }
        return VpnMode.values().firstOrNull { it.id == id } ?: VpnMode.OFF
    }

    fun getCustomProxy(context: Context): String = context
        .getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        .getString(KEY_CUSTOM_PROXY, "socks://127.0.0.1:1080")
        ?: "socks://127.0.0.1:1080"

    private fun normalizeProxy(raw: String): String {
        var value = raw.trim()
        require(value.isNotBlank()) { "Enter a proxy address" }
        if (!value.contains("://")) value = "socks://$value"
        val uri = URI(value)
        val scheme = uri.scheme?.lowercase() ?: throw IllegalArgumentException("Proxy scheme is required")
        require(scheme in setOf("http", "https", "socks", "socks5")) {
            "Use http://, https://, socks:// or socks5://"
        }
        require(!uri.host.isNullOrBlank()) { "Proxy host is required" }
        require(uri.port in 1..65535) { "Proxy port must be between 1 and 65535" }
        require(uri.userInfo.isNullOrBlank()) { "Authenticated proxy URLs are not supported by Android WebView" }
        return if (scheme == "socks5") "socks://${uri.host}:${uri.port}" else value
    }

    private fun endpointHostAndPort(proxy: String): Pair<String, Int> {
        val uri = URI(proxy)
        return (uri.host ?: throw IllegalArgumentException("Proxy host is required")) to uri.port
    }

    /** Direct baseline used only after the user chooses the browser IP verification action. */
    fun checkDirectPublicIp(onResult: (ip: String?, error: String?) -> Unit) {
        executor.execute {
            try {
                val conn = java.net.URL("https://api4.ipify.org?format=json").openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 5_000
                conn.readTimeout = 5_000
                conn.setRequestProperty("User-Agent", "Fokk-Browser-IP-Check")
                if (conn.responseCode != 200) return@execute onResult(null, "HTTP ${conn.responseCode}")
                val ip = org.json.JSONObject(conn.inputStream.bufferedReader().use { it.readText() }).optString("ip", "")
                onResult(ip.ifBlank { null }, null)
            } catch (e: Exception) {
                onResult(null, e.localizedMessage ?: "Timeout")
            }
        }
    }

    fun applyVpnMode(
        context: Context,
        mode: VpnMode,
        customProxy: String? = null,
        onComplete: ((Boolean, String) -> Unit)? = null
    ) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        if (!isSupported()) {
            onComplete?.invoke(false, "This System WebView does not support secure proxy routing.")
            return
        }
        if (mode == VpnMode.OFF) {
            ProxyController.getInstance().clearProxyOverride(executor) {
                prefs.edit().putString(KEY_VPN_MODE, mode.id).apply()
                onComplete?.invoke(true, "Privacy gateway disabled. Browser traffic is direct.")
            }
            return
        }

        val endpoint = try {
            normalizeProxy(customProxy ?: getCustomProxy(context))
        } catch (e: Exception) {
            onComplete?.invoke(false, e.message ?: "Invalid proxy address")
            return
        }
        val (host, port) = try { endpointHostAndPort(endpoint) } catch (e: Exception) {
            onComplete?.invoke(false, e.message ?: "Invalid proxy address")
            return
        }

        executor.execute {
            val reachable = try {
                Socket().use { it.connect(InetSocketAddress(host, port), 1_500) }
                true
            } catch (_: Exception) { false }
            if (!reachable) {
                onComplete?.invoke(false, "Proxy is unreachable at $host:$port. Existing routing was left unchanged.")
                return@execute
            }

            val config = ProxyConfig.Builder()
                .addProxyRule(endpoint)
                .addBypassRule("<local>")
                .addBypassRule("localhost")
                .addBypassRule("127.0.0.1")
                .build()
            try {
                ProxyController.getInstance().setProxyOverride(config, executor) {
                    val editor = prefs.edit().putString(KEY_VPN_MODE, mode.id)
                    if (mode == VpnMode.CUSTOM) editor.putString(KEY_CUSTOM_PROXY, endpoint)
                    editor.apply()
                    onComplete?.invoke(true, "Browser privacy gateway active; direct fallback is disabled.")
                }
            } catch (e: Exception) {
                onComplete?.invoke(false, "Could not apply proxy: ${e.localizedMessage ?: "unknown error"}")
            }
        }
    }

    fun restoreSavedState(context: Context) {
        val mode = getActiveMode(context)
        if (mode != VpnMode.OFF) applyVpnMode(context, mode, getCustomProxy(context))
    }
}
