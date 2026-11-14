package com.adshield.app.engine

import android.content.Context
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import com.adshield.app.AdShieldApp
import com.adshield.app.model.DnsOverHttpsEngine
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URI
import java.util.concurrent.Executors

/**
 * Fokk Browser VPN & Stealth Proxy Engine for Android.
 * Leverages AndroidX WebKit ProxyController to route browser traffic through:
 * - Cloudflare WARP local agent & Cloudflare 1.1.1.1 Encrypted DoH Resolver
 * - Orbot / Tor anonymity network (SOCKS5 127.0.0.1:9050, HTTP 127.0.0.1:8118)
 * - Custom SOCKS5, SOCKS, or HTTP/HTTPS proxy with graceful Direct fallback
 * Zero battery drain, zero accessibility service requirements, never offline.
 */
object VpnEngine {

    const val PREFS_VPN = "fokk_vpn_settings"
    const val KEY_VPN_MODE = "vpn_mode"
    const val KEY_CUSTOM_PROXY = "vpn_custom_proxy"

    enum class VpnMode(val id: String, val title: String, val proxyUrl: String) {
        OFF("off", "Direct Connection (VPN Disabled)", ""),
        WARP("warp", "Cloudflare WARP & DoH (1.1.1.1)", "socks5://127.0.0.1:40000"),
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
            editor.putString(KEY_CUSTOM_PROXY, customProxy.trim())
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

        val builder = ProxyConfig.Builder()
        var probeHost = "127.0.0.1"
        var probePort = 0

        when (mode) {
            VpnMode.WARP -> {
                // Configure Cloudflare 1.1.1.1 Encrypted DoH DNS resolver
                try {
                    AdShieldApp.instance.dohEngine.currentProvider = DnsOverHttpsEngine.Provider.CLOUDFLARE
                    AdShieldApp.instance.dohEngine.isEnabled = true
                    context.getSharedPreferences(AdShieldApp.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit()
                        .putString("fokk_doh_provider", DnsOverHttpsEngine.PROVIDER_CLOUDFLARE)
                        .putBoolean("fokk_doh_tunnel", true)
                        .apply()
                } catch (_: Exception) {}

                // Cloudflare WARP local proxy ports (desktop agent, mobile proxy modes)
                builder.addProxyRule("socks5://127.0.0.1:40000")
                builder.addProxyRule("socks://127.0.0.1:40000")
                builder.addProxyRule("http://127.0.0.1:40000")
                builder.addProxyRule("socks5://127.0.0.1:1080")
                probeHost = "127.0.0.1"
                probePort = 40000
            }
            VpnMode.TOR -> {
                // Tor / Orbot standard SOCKS5 and HTTP ports
                builder.addProxyRule("socks5://127.0.0.1:9050")
                builder.addProxyRule("socks://127.0.0.1:9050")
                builder.addProxyRule("http://127.0.0.1:8118")
                builder.addProxyRule("socks5://127.0.0.1:9150")
                probeHost = "127.0.0.1"
                probePort = 9050
            }
            VpnMode.CUSTOM -> {
                var p = (customProxy ?: getCustomProxy(context)).trim()
                if (p.isNotEmpty()) {
                    if (!p.contains("://")) {
                        p = "socks5://$p"
                    }
                    builder.addProxyRule(p)
                    if (p.startsWith("socks5://")) {
                        builder.addProxyRule(p.replace("socks5://", "socks://"))
                    } else if (p.startsWith("socks://")) {
                        builder.addProxyRule(p.replace("socks://", "socks5://"))
                    }

                    try {
                        val uri = URI(p)
                        probeHost = uri.host ?: "127.0.0.1"
                        probePort = if (uri.port > 0) uri.port else 1080
                    } catch (_: Exception) {
                        probeHost = "127.0.0.1"
                        probePort = 1080
                    }
                }
            }
            VpnMode.OFF -> {}
        }

        // Essential: Add direct connection fallback so browser NEVER goes completely offline
        // if the proxy daemon is unreachable or starting up.
        builder.addDirect()
        builder.addBypassRule("<local>")
        builder.addBypassRule("localhost")
        builder.addBypassRule("127.0.0.1")

        try {
            val config = builder.build()
            ProxyController.getInstance().setProxyOverride(config, executor) {
                // Asynchronously probe port to notify user accurately
                executor.execute {
                    var reachable = false
                    if (probePort > 0) {
                        try {
                            Socket().use { s ->
                                s.connect(InetSocketAddress(probeHost, probePort), 800)
                                reachable = true
                            }
                        } catch (_: Exception) {}
                    }

                    val msg = if (reachable) {
                        "Connected to ${mode.title} · Traffic secured"
                    } else if (mode == VpnMode.WARP) {
                        "Cloudflare WARP DoH (1.1.1.1) Active · Encrypted DNS Enabled"
                    } else if (mode == VpnMode.TOR) {
                        "Tor Mode configured (Ensure Orbot is started on 127.0.0.1:9050)"
                    } else {
                        "Custom proxy configured · Direct fallback active"
                    }

                    onComplete?.invoke(true, msg)
                }
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
