package com.adshield.app.engine

import android.content.Context
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import java.util.concurrent.Executors

/**
 * Fokk Browser VPN & Stealth Proxy Engine for Android.
 * Leverages AndroidX WebKit ProxyController to route browser traffic through:
 * - Cloudflare WARP local agent (SOCKS5 127.0.0.1:40000)
 * - Orbot / Tor anonymity network (SOCKS5 127.0.0.1:9050)
 * - Custom SOCKS5 or HTTP/HTTPS proxy
 * Zero battery drain, zero accessibility service requirements.
 */
object VpnEngine {

    const val PREFS_VPN = "fokk_vpn_settings"
    const val KEY_VPN_MODE = "vpn_mode"
    const val KEY_CUSTOM_PROXY = "vpn_custom_proxy"

    enum class VpnMode(val id: String, val title: String, val proxyUrl: String) {
        OFF("off", "Direct Connection (VPN Disabled)", ""),
        WARP("warp", "Cloudflare WARP (Local Agent: 127.0.0.1:40000)", "socks5://127.0.0.1:40000"),
        TOR("tor", "Tor / Orbot Onion Router (127.0.0.1:9050)", "socks5://127.0.0.1:9050"),
        CUSTOM("custom", "Custom SOCKS5 / HTTP Proxy", "")
    }

    private val executor = Executors.newSingleThreadExecutor()

    fun isSupported(): Boolean {
        return WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)
    }

    fun getActiveMode(context: Context): VpnMode {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        val id = prefs.getString(KEY_VPN_MODE, VpnMode.OFF.id) ?: VpnMode.OFF.id
        return VpnMode.values().firstOrNull { it.id == id } ?: VpnMode.OFF
    }

    fun getCustomProxy(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        return prefs.getString(KEY_CUSTOM_PROXY, "socks5://127.0.0.1:1080") ?: "socks5://127.0.0.1:1080"
    }

    fun applyVpnMode(
        context: Context,
        mode: VpnMode,
        customProxy: String? = null,
        onComplete: ((Boolean, String) -> Unit)? = null
    ) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        val editor = prefs.edit().putString(KEY_VPN_MODE, mode.id)
        if (customProxy != null) {
            editor.putString(KEY_CUSTOM_PROXY, customProxy)
        }
        editor.apply()

        if (!isSupported()) {
            onComplete?.invoke(false, "ProxyOverride feature is not supported by the system WebView.")
            return
        }

        if (mode == VpnMode.OFF) {
            ProxyController.getInstance().clearProxyOverride(executor) {
                onComplete?.invoke(true, "VPN disabled. Traffic is direct.")
            }
            return
        }

        val rule = when (mode) {
            VpnMode.WARP -> VpnMode.WARP.proxyUrl
            VpnMode.TOR -> VpnMode.TOR.proxyUrl
            VpnMode.CUSTOM -> {
                val p = (customProxy ?: getCustomProxy(context)).trim()
                if (p.startsWith("socks5://") || p.startsWith("http://") || p.startsWith("https://")) {
                    p
                } else {
                    "socks5://$p"
                }
            }
            VpnMode.OFF -> ""
        }

        try {
            val config = ProxyConfig.Builder()
                .addProxyRule(rule)
                .build()

            ProxyController.getInstance().setProxyOverride(config, executor) {
                onComplete?.invoke(true, "Routing browser traffic through ${mode.title}")
            }
        } catch (e: Exception) {
            onComplete?.invoke(false, "Failed to apply proxy: ${e.localizedMessage}")
        }
    }

    fun restoreSavedState(context: Context) {
        val mode = getActiveMode(context)
        if (mode != VpnMode.OFF) {
            applyVpnMode(context, mode, getCustomProxy(context))
        }
    }
}
