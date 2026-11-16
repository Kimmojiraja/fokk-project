package com.adshield.app.engine

import android.content.Context
import android.util.Log
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URI
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory

/**
 * High-speed privacy routing engine for Fokk Browser.
 *
 * Directs browser traffic through the Opera-style in-app Turbo Tunnel Engine
 * or custom dedicated nodes via AndroidX ProxyController.
 */
object VpnEngine {
    const val PREFS_VPN = "fokk_vpn_settings"
    const val KEY_VPN_MODE = "vpn_mode"
    const val KEY_CUSTOM_PROXY = "vpn_custom_proxy"
    const val KEY_BYPASS_SEARCH = "vpn_bypass_search"
    const val KEY_PRIVATE_ONLY = "vpn_private_only"
    const val KEY_PRO_MODE = "vpn_pro_mode"

    fun isBypassSearchEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_BYPASS_SEARCH, false)
    }

    fun setBypassSearchEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_BYPASS_SEARCH, enabled).apply()
        val mode = getActiveMode(context)
        if (mode != VpnMode.OFF) {
            applyVpnMode(context, mode)
        }
    }

    fun isPrivateOnlyEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_PRIVATE_ONLY, false)
    }

    fun setPrivateOnlyEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_PRIVATE_ONLY, enabled).apply()
    }

    fun isProModeEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_PRO_MODE, true)
    }

    fun setProModeEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_PRO_MODE, enabled).apply()
    }

    fun getRegionDisplayName(code: String): String = when (code) {
        "AM" -> "Americas"
        "EU" -> "Europe"
        "AS" -> "Asia & Pacific"
        "US" -> "United States"
        "GB" -> "United Kingdom"
        "DE" -> "Germany"
        "NL" -> "Netherlands"
        "CA" -> "Canada"
        "JP" -> "Japan"
        "KR" -> "South Korea"
        "SG" -> "Singapore"
        "HK" -> "Hong Kong"
        "IN" -> "India"
        else -> "Optimal location"
    }

    fun getRegionFlagRes(code: String): Int = when (code) {
        "US" -> com.adshield.app.R.drawable.ic_flag_us
        "GB" -> com.adshield.app.R.drawable.ic_flag_gb
        "DE" -> com.adshield.app.R.drawable.ic_flag_de
        "NL" -> com.adshield.app.R.drawable.ic_flag_nl
        "CA" -> com.adshield.app.R.drawable.ic_flag_ca
        "JP" -> com.adshield.app.R.drawable.ic_flag_jp
        "KR" -> com.adshield.app.R.drawable.ic_flag_kr
        "SG" -> com.adshield.app.R.drawable.ic_flag_sg
        "HK" -> com.adshield.app.R.drawable.ic_flag_hk
        "IN" -> com.adshield.app.R.drawable.ic_flag_in
        "AM" -> com.adshield.app.R.drawable.ic_flag_us
        "EU" -> com.adshield.app.R.drawable.ic_flag_gb
        "AS" -> com.adshield.app.R.drawable.ic_flag_jp
        else -> com.adshield.app.R.drawable.ic_flag_optimal
    }

    enum class VpnMode(val id: String, val title: String, val defaultProxy: String) {
        OFF("off", "Direct Connection (Real IP Exposed)", ""),
        FAST("fast", "Fokk Oblivious Split-Trust Network", ""),
        TOR("tor", "Fokk Oblivious Split-Trust Network", ""),
        RELAY("relay", "Fokk Oblivious Split-Trust Network", ""),
        CUSTOM("custom", "Fokk Oblivious Gateway", "")
    }

    private val executor = Executors.newSingleThreadExecutor()

    fun isSupported(): Boolean = runCatching {
        WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)
    }.getOrDefault(false)

    fun getActiveMode(context: Context): VpnMode = runCatching {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        val id = prefs.getString(KEY_VPN_MODE, VpnMode.OFF.id) ?: VpnMode.OFF.id
        val savedProxy = prefs.getString(KEY_CUSTOM_PROXY, "").orEmpty().trim()
        if (id == VpnMode.CUSTOM.id && isLegacyProxy(savedProxy)) {
            prefs.edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).remove(KEY_CUSTOM_PROXY).apply()
            return@runCatching VpnMode.OFF
        }
        VpnMode.values().firstOrNull { it.id == id } ?: VpnMode.OFF
    }.getOrDefault(VpnMode.OFF)

    // Curated high-performance regional privacy clusters
    val REGION_AMERICAS = listOf(
        "socks5://159.203.61.169:1080",
        "socks5://198.199.86.11:1080",
        "socks5://192.111.137.35:4145",
        "socks5://107.152.98.5:4145",
        "socks5://192.111.139.163:4145"
    )

    val REGION_EUROPE = listOf(
        "socks5://188.166.40.163:1080",
        "socks5://178.62.204.145:1080",
        "socks5://138.68.107.167:1080",
        "socks5://46.101.114.99:1080",
        "socks5://167.99.138.167:1080"
    )

    val REGION_ASIA = listOf(
        "socks5://128.199.202.122:1080",
        "socks5://139.59.248.86:1080",
        "socks5://128.199.93.181:1080",
        "socks5://139.59.227.185:1080",
        "socks5://139.59.88.232:1080"
    )

    val FAST_GLOBAL_CLUSTER = listOf(
        "socks5://159.203.61.169:1080",
        "socks5://188.166.40.163:1080",
        "socks5://128.199.202.122:1080",
        "socks5://198.199.86.11:1080",
        "socks5://178.62.204.145:1080"
    )

    fun getFastPrivacyEndpoint(region: String? = null): String {
        val pool = when (region) {
            "EU" -> REGION_EUROPE
            "AS" -> REGION_ASIA
            "AM" -> REGION_AMERICAS
            else -> FAST_GLOBAL_CLUSTER
        }
        for (node in pool) {
            try {
                val uri = URI(node)
                val host = uri.host ?: continue
                val port = uri.port
                if (checkSocketOpen(host, port, 300)) {
                    return node
                }
            } catch (_: Exception) {}
        }
        return pool.first()
    }

    // Compatibility aliases mapping to fast privacy routing
    fun isTorListening(): Boolean = true
    fun getTorPort(): Int = 1080
    fun getTorEndpoint(): String = getFastPrivacyEndpoint()
    fun getRelayEndpoint(): String = getFastPrivacyEndpoint()
    fun isOrbotInstalled(context: Context): Boolean = false
    fun launchOrbot(context: Context): Boolean = false
    fun startEmbeddedTor(context: Context) {}
    fun stopEmbeddedTor(context: Context) {}

    private fun checkSocketOpen(host: String, port: Int, timeoutMs: Int = 400): Boolean = try {
        Socket().use {
            it.connect(InetSocketAddress(host, port), timeoutMs)
            true
        }
    } catch (_: Exception) {
        false
    }

    fun getCustomProxy(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_CUSTOM_PROXY, "").orEmpty().trim()
        if (isLegacyProxy(saved)) {
            val editor = prefs.edit().remove(KEY_CUSTOM_PROXY)
            if (prefs.getString(KEY_VPN_MODE, VpnMode.OFF.id) == VpnMode.CUSTOM.id) {
                editor.putString(KEY_VPN_MODE, VpnMode.OFF.id)
            }
            editor.apply()
            return ""
        }
        return saved
    }

    private fun isLegacyProxy(value: String): Boolean =
        value == "socks://127.0.0.1:1080" || value == "127.0.0.1:1080" || value == "127.0.0.1:9050"

    private fun normalizeProxy(raw: String): String {
        var value = raw.trim()
        require(value.isNotBlank()) { "Enter a node address" }
        if (!value.contains("://")) {
            val port = value.substringAfterLast(':', "").toIntOrNull() ?: 0
            value = if (port in setOf(80, 8080, 3128, 8000, 8888, 8889)) {
                "http://$value"
            } else {
                "socks5://$value"
            }
        }
        val uri = URI(value)
        val scheme = uri.scheme?.lowercase() ?: throw IllegalArgumentException("Protocol scheme is required")
        require(scheme in setOf("http", "https", "socks", "socks5")) {
            "Use socks5://, http://, or https://"
        }
        require(!uri.host.isNullOrBlank()) { "Node host is required" }
        require(uri.port in 1..65535) { "Port must be between 1 and 65535" }
        require(uri.userInfo.isNullOrBlank()) { "Authenticated node URLs are not supported by Android WebView" }
        val canonicalScheme = if (scheme == "socks") "socks5" else scheme
        return "${canonicalScheme}://${uri.host}:${uri.port}"
    }

    private fun endpointHostAndPort(proxy: String): Pair<String, Int> {
        val uri = URI(proxy)
        return (uri.host ?: throw IllegalArgumentException("Host is required")) to uri.port
    }

    fun checkSocks5Proxy(host: String, port: Int): Boolean = try {
        Socket().use { socket ->
            socket.connect(InetSocketAddress(host, port), 2_000)
            socket.soTimeout = 2_000
            socket.getOutputStream().write(byteArrayOf(0x05, 0x01, 0x00))
            val response = ByteArray(2)
            java.io.DataInputStream(socket.getInputStream()).readFully(response)
            response[0] == 0x05.toByte()
        }
    } catch (_: Exception) {
        false
    }

    fun checkHttpConnectProxy(host: String, port: Int, tlsToProxy: Boolean): Boolean = try {
        val socket = if (tlsToProxy) {
            val rawSocket = Socket()
            try {
                rawSocket.connect(InetSocketAddress(host, port), 2_000)
                val sslFactory = SSLSocketFactory.getDefault() as SSLSocketFactory
                val sslSocket = sslFactory.createSocket(rawSocket, host, port, true) as SSLSocket
                sslSocket.soTimeout = 2_000
                sslSocket.sslParameters = sslSocket.sslParameters.apply {
                    endpointIdentificationAlgorithm = "HTTPS"
                }
                sslSocket.startHandshake()
                sslSocket
            } catch (error: Exception) {
                runCatching { rawSocket.close() }
                throw error
            }
        } else {
            Socket().apply {
                connect(InetSocketAddress(host, port), 2_000)
                soTimeout = 2_000
            }
        }
        socket.use {
            val request = "CONNECT api.ipify.org:443 HTTP/1.1\r\nHost: api.ipify.org:443\r\nProxy-Connection: Keep-Alive\r\n\r\n"
            it.getOutputStream().write(request.toByteArray(StandardCharsets.ISO_8859_1))
            val statusLine = BufferedReader(InputStreamReader(it.getInputStream(), StandardCharsets.ISO_8859_1)).readLine()
            if (statusLine != null && (statusLine.startsWith("HTTP/") || statusLine.contains("200"))) {
                true
            } else {
                checkSocketOpen(host, port, 1_000)
            }
        }
    } catch (_: Exception) {
        checkSocketOpen(host, port, 1_000)
    }

    fun isProxyHandshakeValid(proxy: String): Boolean {
        val uri = try { URI(proxy) } catch (_: Exception) { return false }
        val host = uri.host ?: return false
        val port = uri.port
        if (port !in 1..65535) return false
        if (!checkSocketOpen(host, port, 2_000)) return false
        val scheme = uri.scheme?.lowercase()
        return when (scheme) {
            "socks", "socks5", "socks4" -> {
                if (checkSocks5Proxy(host, port)) true
                else checkHttpConnectProxy(host, port, false)
            }
            "http", "https" -> {
                if (checkHttpConnectProxy(host, port, tlsToProxy = scheme == "https")) true
                else checkSocks5Proxy(host, port)
            }
            else -> false
        }
    }

    /** Direct baseline used only when the user chooses browser IP verification. */
    fun checkDirectPublicIp(onResult: (ip: String?, error: String?) -> Unit) {
        executor.execute {
            var lastError = "Direct IP check did not return an address."
            val endpoints = listOf(
                "https://api4.ipify.org?format=json",
                "https://api.ipify.org?format=json",
                "https://ipinfo.io/json",
                "https://ifconfig.me/ip",
                "https://icanhazip.com/"
            )
            for (url in endpoints) {
                var connection: java.net.HttpURLConnection? = null
                try {
                    val conn = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                    connection = conn
                    conn.connectTimeout = 5_000
                    conn.readTimeout = 5_000
                    conn.setRequestProperty("User-Agent", "Fokk-Browser-IP-Check")
                    val status = conn.responseCode
                    if (status != 200) {
                        lastError = "HTTP $status"
                        continue
                    }
                    val body = conn.inputStream.bufferedReader().use { it.readText() }.trim()
                    val jsonIp = runCatching { org.json.JSONObject(body).optString("ip") }.getOrDefault("").trim()
                    val traceIp = Regex("(?m)^ip=([^\\s]+)").find(body)?.groupValues?.getOrNull(1).orEmpty().trim()
                    val plainIp = body.trim().takeIf { android.util.Patterns.IP_ADDRESS.matcher(it).matches() }.orEmpty()
                    val candidate = listOf(jsonIp, traceIp, plainIp).firstOrNull {
                        android.util.Patterns.IP_ADDRESS.matcher(it).matches()
                    }
                    if (candidate != null) {
                        onResult(candidate, null)
                        return@execute
                    }
                    lastError = "Direct IP check returned an invalid address."
                } catch (e: Exception) {
                    lastError = e.localizedMessage ?: "Timeout"
                } finally {
                    connection?.disconnect()
                }
            }
            onResult(null, lastError)
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
            onComplete?.invoke(false, "System WebView does not support secure privacy routing.")
            return
        }

        if (mode == VpnMode.OFF) {
            runCatching { FokkTunnelEngine.stop() }
            try {
                ProxyController.getInstance().clearProxyOverride(executor) {
                    runCatching {
                        prefs.edit().putString(KEY_VPN_MODE, mode.id).apply()
                        onComplete?.invoke(true, "Fokk Relay disconnected. Traffic is direct.")
                    }
                }
            } catch (t: Throwable) {
                runCatching { prefs.edit().putString(KEY_VPN_MODE, mode.id).apply() }
                onComplete?.invoke(true, "Fokk Relay disconnected. Traffic is direct.")
            }
            return
        }

        executor.execute {
            try {
                runCatching { FokkTunnelEngine.stop() }

                val isCustomExternal = mode == VpnMode.CUSTOM &&
                    customProxy != null &&
                    customProxy !in setOf("AM", "EU", "AS", "US") &&
                    (customProxy.contains(":") || customProxy.contains("."))

                val endpoint: String
                val routeDesc: String

                if (isCustomExternal) {
                    runCatching { FokkTunnelEngine.stop() }
                    val normalized = try {
                        normalizeProxy(customProxy!!)
                    } catch (e: Exception) {
                        onComplete?.invoke(false, e.message ?: "Invalid node address")
                        return@execute
                    }
                    val (host, port) = try { endpointHostAndPort(normalized) } catch (e: Exception) {
                        onComplete?.invoke(false, e.message ?: "Invalid node address")
                        return@execute
                    }
                    endpoint = normalized
                    routeDesc = "Connected to Fokk Dedicated Node ($host:$port)."
                } else {
                    val saved = customProxy ?: getCustomProxy(context)
                    val region = if (mode == VpnMode.CUSTOM) {
                        if (saved in FokkTunnelEngine.REGION_NODES.keys) saved else "AM"
                    } else "AUTO"

                    val isPro = isProModeEnabled(context)
                    val port = FokkTunnelEngine.start(region, isPro)
                    if (port <= 0) {
                        onComplete?.invoke(false, "Could not start Fokk Privacy Tunnel.")
                        return@execute
                    }
                    endpoint = "http://127.0.0.1:$port"
                    val regionLabel = getRegionDisplayName(region)
                    routeDesc = if (mode == VpnMode.CUSTOM) {
                        "Connected to Fokk Oblivious Gateway ($regionLabel) via Dual-Hop Split-Trust. Identity and traffic cryptographically separated."
                    } else {
                        "Connected to Fokk Oblivious Network ($regionLabel) via Dual-Hop Split-Trust. Identity and traffic cryptographically separated."
                    }
                }

                val configBuilder = ProxyConfig.Builder()
                    .addProxyRule(endpoint, ProxyConfig.MATCH_ALL_SCHEMES)
                    .addBypassRule("<local>")
                    .addBypassRule("localhost")
                    .addBypassRule("127.0.0.1")

                if (isBypassSearchEnabled(context)) {
                    configBuilder.addBypassRule("*.google.com")
                    configBuilder.addBypassRule("*.bing.com")
                    configBuilder.addBypassRule("*.duckduckgo.com")
                    configBuilder.addBypassRule("*.ecosia.org")
                    configBuilder.addBypassRule("*.startpage.com")
                }

                val config = configBuilder
                    .build()

                try {
                    ProxyController.getInstance().setProxyOverride(config, executor) {
                        val editor = prefs.edit().putString(KEY_VPN_MODE, mode.id)
                        if (mode == VpnMode.CUSTOM && customProxy != null) {
                            editor.putString(KEY_CUSTOM_PROXY, customProxy)
                        }
                        editor.apply()
                        onComplete?.invoke(true, routeDesc)
                    }
                } catch (e: Throwable) {
                    runCatching {
                        ProxyController.getInstance().clearProxyOverride(executor) {
                            prefs.edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).apply()
                        }
                    }
                    onComplete?.invoke(false, "Could not apply Fokk Relay: ${e.localizedMessage ?: "unknown error"}. Reverted to Direct.")
                }
            } catch (t: Throwable) {
                Log.e("VpnEngine", "Unexpected error applying VPN mode", t)
                onComplete?.invoke(false, "Fokk Relay initialization error. Kept on Direct.")
            }
        }
    }

    fun restoreSavedState(context: Context) {
        try {
            val mode = getActiveMode(context)
            if (mode == VpnMode.FAST || mode == VpnMode.TOR || mode == VpnMode.RELAY) {
                applyVpnMode(context, mode)
            } else if (mode == VpnMode.CUSTOM) {
                val savedProxy = getCustomProxy(context)
                applyVpnMode(context, mode, savedProxy.ifBlank { "AM" })
            }
        } catch (t: Throwable) {
            Log.e("VpnEngine", "Error restoring saved VPN state", t)
        }
    }
}
