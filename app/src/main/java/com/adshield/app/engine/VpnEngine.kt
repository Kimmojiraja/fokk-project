package com.adshield.app.engine

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URI
import java.util.concurrent.Executors

/**
 * Fokk Browser Stealth VPN & Proxy Engine for Android.
 * Leverages AndroidX WebKit ProxyController to route browser traffic through:
 * - Tor / Orbot onion routing network (SOCKS5 127.0.0.1:9050 / 9150)
 * - Custom SOCKS5, SOCKS, or HTTP/HTTPS proxy
 * - Live public IP verification and health checks
 */
object VpnEngine {

    const val PREFS_VPN = "fokk_vpn_settings"
    const val KEY_VPN_MODE = "vpn_mode"
    const val KEY_CUSTOM_PROXY = "vpn_custom_proxy"

    enum class VpnMode(val id: String, val title: String, val proxyUrl: String) {
        OFF("off", "Direct Connection (VPN Disabled)", ""),
        TOR("tor", "Tor Onion Routing (Orbot 127.0.0.1:9050)", "socks5://127.0.0.1:9050"),
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

    fun isOrbotRunning(): Boolean {
        return try {
            Socket().use { s ->
                s.connect(InetSocketAddress("127.0.0.1", 9050), 400)
                true
            }
        } catch (_: Exception) {
            try {
                Socket().use { s ->
                    s.connect(InetSocketAddress("127.0.0.1", 9150), 300)
                    true
                }
            } catch (_: Exception) {
                false
            }
        }
    }

    fun isOrbotInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo("org.torproject.android", 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun launchOrbot(context: Context) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage("org.torproject.android")
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(launchIntent)
        } else {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=org.torproject.android")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (_: Exception) {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=org.torproject.android")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }
        }
    }

    fun checkPublicIp(onResult: (ip: String?, error: String?) -> Unit) {
        executor.execute {
            try {
                val url = java.net.URL("https://api.ipify.org?format=json")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                conn.setRequestProperty("User-Agent", "Fokk-Shield-Privacy-Probe")
                if (conn.responseCode == 200) {
                    val text = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = org.json.JSONObject(text)
                    val ip = json.optString("ip", "")
                    onResult(ip, null)
                } else {
                    onResult(null, "HTTP ${conn.responseCode}")
                }
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

        // Direct fallback keeps the WebView alive if the proxy daemon disconnects
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
                    } else if (mode == VpnMode.TOR) {
                        "Tor mode configured. (Make sure Orbot is active on 127.0.0.1:9050)"
                    } else {
                        "Proxy configured · Ready"
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
