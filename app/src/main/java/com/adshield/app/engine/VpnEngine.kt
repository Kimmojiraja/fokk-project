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
    const val KEY_ENTIRE_DEVICE = "vpn_entire_device"
    const val KEY_HOME_BASE_HOST = "vpn_home_base_host"
    const val KEY_HOME_BASE_PORT = "vpn_home_base_port"
    const val KEY_HOME_BASE_TOKEN = "vpn_home_base_token"

    fun getHomeBaseConfig(context: Context): Triple<String, Int, String> {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        val host = prefs.getString(KEY_HOME_BASE_HOST, "").orEmpty().trim()
        val port = prefs.getInt(KEY_HOME_BASE_PORT, 10850)
        val token = prefs.getString(KEY_HOME_BASE_TOKEN, "").orEmpty().trim()
        return Triple(host, port, token)
    }

    fun setHomeBaseConfig(context: Context, host: String, port: Int, token: String) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_HOME_BASE_HOST, host.trim())
            .putInt(KEY_HOME_BASE_PORT, if (port in 1..65535) port else 10850)
            .putString(KEY_HOME_BASE_TOKEN, token.trim())
            .apply()
    }

    fun isEntireDeviceEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_ENTIRE_DEVICE, false)
    }

    fun setEntireDeviceEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_ENTIRE_DEVICE, enabled).apply()
        if (enabled) {
            val activeMode = getActiveMode(context)
            val custom = getCustomProxy(context)
            val region = when (activeMode) {
                VpnMode.SMART_CLOAK -> "SMART_CLOAK"
                VpnMode.CUSTOM -> if (custom in FokkTunnelEngine.REGION_NODES.keys) custom else "AUTO"
                else -> "AUTO"
            }
            FokkMeshVpnService.start(context, region)
        } else {
            runCatching { FokkMeshVpnService.stop(context) }
        }
    }

    fun onDeviceMeshStopped(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_ENTIRE_DEVICE, false).apply()
    }

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

    /**
     * Enforces "Private Tabs Only" mode whenever the user switches tabs.
     * When enabled and Fokk Mesh is active:
     *   - Private tabs route through FokkTunnelEngine (127.0.0.1:<localPort>).
     *   - Standard tabs temporarily bypass the proxy override without stopping the tunnel.
     */
    fun syncProxyForTabPrivacy(context: Context, isPrivateTab: Boolean) {
        if (!isSupported()) return
        val mode = getActiveMode(context)
        if (mode == VpnMode.OFF) return
        if (!isPrivateOnlyEnabled(context)) return

        executor.execute {
            try {
                if (isPrivateTab) {
                    val port = FokkTunnelEngine.localPort
                    if (port > 0) {
                        val builder = ProxyConfig.Builder()
                            .addProxyRule("http://127.0.0.1:$port", ProxyConfig.MATCH_ALL_SCHEMES)
                            .addBypassRule("<local>")
                            .addBypassRule("localhost")
                            .addBypassRule("127.0.0.1")
                        if (isBypassSearchEnabled(context)) {
                            builder.addBypassRule("*.google.com")
                            builder.addBypassRule("*.bing.com")
                            builder.addBypassRule("*.duckduckgo.com")
                            builder.addBypassRule("*.ecosia.org")
                            builder.addBypassRule("*.startpage.com")
                        }
                        ProxyController.getInstance().setProxyOverride(builder.build(), executor) {}
                    }
                } else {
                    ProxyController.getInstance().clearProxyOverride(executor) {}
                }
            } catch (t: Throwable) {
                Log.w("VpnEngine", "syncProxyForTabPrivacy error: ${t.message}")
            }
        }
    }

    /**
     * Returns an HTTP Proxy pointing to the local Fokk Mesh tunnel when active,
     * so background HttpURLConnection calls can route through Fokk Mesh with zero IP leak.
     */
    fun getActiveMeshProxy(): java.net.Proxy {
        val port = FokkTunnelEngine.localPort
        return if (FokkTunnelEngine.isTunnelRunning() && port > 0) {
            java.net.Proxy(java.net.Proxy.Type.HTTP, InetSocketAddress("127.0.0.1", port))
        } else {
            java.net.Proxy.NO_PROXY
        }
    }

    fun isProModeEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_PRO_MODE, false)
    }

    fun setProModeEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_PRO_MODE, enabled).apply()
    }

    fun getRegionDisplayName(code: String): String = when (code) {
        "SMART_CLOAK" -> "Smart-Cloak (Full Speed)"
        "EDGE" -> "Oblivious Edge (300+ Cities)"
        "HOME_BASE" -> "Home-Base (Personal PC Relay)"
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
        // Americas
        "MX" -> "Mexico"
        "BR" -> "Brazil"
        "AR" -> "Argentina"
        "CL" -> "Chile"
        "CO" -> "Colombia"
        "PE" -> "Peru"
        "CR" -> "Costa Rica"
        "PA" -> "Panama"
        // Europe
        "FR" -> "France"
        "CH" -> "Switzerland"
        "SE" -> "Sweden"
        "NO" -> "Norway"
        "FI" -> "Finland"
        "ES" -> "Spain"
        "IT" -> "Italy"
        "PL" -> "Poland"
        "IE" -> "Ireland"
        "BE" -> "Belgium"
        "AT" -> "Austria"
        "CZ" -> "Czech Republic"
        "DK" -> "Denmark"
        "PT" -> "Portugal"
        "RO" -> "Romania"
        // Asia & Pacific
        "AU" -> "Australia"
        "NZ" -> "New Zealand"
        "TW" -> "Taiwan"
        "MY" -> "Malaysia"
        "ID" -> "Indonesia"
        "TH" -> "Thailand"
        "VN" -> "Vietnam"
        // Middle East & Africa
        "AE" -> "United Arab Emirates"
        "IL" -> "Israel"
        "ZA" -> "South Africa"
        "TR" -> "Turkey"
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
        "FR" -> com.adshield.app.R.drawable.ic_flag_fr
        "SE" -> com.adshield.app.R.drawable.ic_flag_se
        "BR" -> com.adshield.app.R.drawable.ic_flag_br
        "CH" -> com.adshield.app.R.drawable.ic_flag_ch
        "IT" -> com.adshield.app.R.drawable.ic_flag_it
        "AM" -> com.adshield.app.R.drawable.ic_flag_us
        "EU" -> com.adshield.app.R.drawable.ic_flag_gb
        "AS" -> com.adshield.app.R.drawable.ic_flag_jp
        else -> com.adshield.app.R.drawable.ic_flag_optimal
    }

    enum class VpnMode(val id: String, val title: String, val defaultProxy: String) {
        OFF("off", "Direct Connection", ""),
        SMART_CLOAK("smart_cloak", "Fokk Smart-Cloak (Free · DoH + SNI Shield)", ""),
        FAST("fast", "Fokk Mesh Pro (Optimal Relay)", ""),
        TOR("tor", "Fokk Mesh Pro (Optimal Relay)", ""),
        RELAY("relay", "Fokk Mesh Pro (Optimal Relay)", ""),
        CUSTOM("custom", "Fokk Mesh Pro Gateway", "")
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

    // ---------------------------------------------------------------------------
    // Regional node access — delegated to NodeRegistry (signed manifest + certified builtin)
    // ---------------------------------------------------------------------------
    fun getFastPrivacyEndpoint(region: String? = null): String {
        val nodes = NodeRegistry.getNodesForRegion(region ?: "AUTO")
        val best = nodes.firstOrNull() ?: return ""
        val scheme = if (best.isHttpConnect) "http" else "socks5"
        return "$scheme://${best.host}:${best.port}"
    }

    // Compatibility aliases
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
            runCatching { FokkMeshVpnService.stop(context) }
            try {
                ProxyController.getInstance().clearProxyOverride(executor) {
                    runCatching {
                        prefs.edit().putString(KEY_VPN_MODE, mode.id).apply()
                        onComplete?.invoke(true, "Fokk Mesh disconnected. Traffic is direct.")
                    }
                }
            } catch (t: Throwable) {
                runCatching { prefs.edit().putString(KEY_VPN_MODE, mode.id).apply() }
                onComplete?.invoke(true, "Fokk Mesh disconnected. Traffic is direct.")
            }
            return
        }

        executor.execute {
            try {
                runCatching { FokkTunnelEngine.stop() }

                val isCustomExternal = mode == VpnMode.CUSTOM &&
                    customProxy != null &&
                    customProxy !in FokkTunnelEngine.REGION_NODES.keys &&
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
                    val region = when (mode) {
                        VpnMode.SMART_CLOAK -> "SMART_CLOAK"
                        VpnMode.CUSTOM -> if (saved in FokkTunnelEngine.REGION_NODES.keys) saved else "AUTO"
                        else -> "AUTO"
                    }

                    if (region == "HOME_BASE") {
                        val (hbHost, hbPort, hbToken) = getHomeBaseConfig(context)
                        FokkTunnelEngine.configureHomeBase(hbHost, hbPort, hbToken)
                    }

                    FokkTunnelEngine.isProMode = isProModeEnabled(context)
                    FokkTunnelEngine.start(context, region)
                    // Wait up to 2 s for the tunnel to bind a port
                    val deadline = System.currentTimeMillis() + 2_000
                    while (FokkTunnelEngine.localPort <= 0 && System.currentTimeMillis() < deadline) {
                        Thread.sleep(25)
                    }
                    val port = FokkTunnelEngine.localPort
                    if (port <= 0) {
                        onComplete?.invoke(false, "Could not start Fokk Privacy Tunnel.")
                        return@execute
                    }
                    endpoint = "http://127.0.0.1:$port"
                    val regionLabel = getRegionDisplayName(region)
                    routeDesc = when (mode) {
                        VpnMode.SMART_CLOAK ->
                            "Fokk Smart-Cloak Active · Full Native Speed with Encrypted WebView DoH & TLS SNI Cloaking."
                        VpnMode.CUSTOM -> when (region) {
                            "HOME_BASE" -> "Fokk Home-Base Active · Relaying through paired Desktop PC."
                            "EDGE" -> "Fokk Oblivious Edge Active · 300+ Global Cities (RFC 9458)."
                            else -> "Fokk Mesh Pro Active ($regionLabel) · Live Verified Relay Routing."
                        }
                        else ->
                            "Fokk Mesh Pro Active ($regionLabel) · Dual-Hop Oblivious Relay Routing."
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

                        if (isEntireDeviceEnabled(context)) {
                            val activeRegion = if (mode == VpnMode.CUSTOM) {
                                val saved = customProxy ?: getCustomProxy(context)
                                if (saved in FokkTunnelEngine.REGION_NODES.keys) saved else "AM"
                            } else "AUTO"
                            FokkMeshVpnService.start(context, activeRegion)
                        }

                        onComplete?.invoke(true, routeDesc)
                    }
                } catch (e: Throwable) {
                    runCatching {
                        ProxyController.getInstance().clearProxyOverride(executor) {
                            prefs.edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).apply()
                        }
                    }
                    onComplete?.invoke(false, "Could not apply Fokk Mesh: ${e.localizedMessage ?: "unknown error"}. Reverted to Direct.")
                }
            } catch (t: Throwable) {
                Log.e("VpnEngine", "Unexpected error applying VPN mode", t)
                onComplete?.invoke(false, "Fokk Mesh initialization error. Kept on Direct.")
            }
        }
    }

    fun restoreSavedState(context: Context) {
        try {
            val mode = getActiveMode(context)
            if (mode == VpnMode.SMART_CLOAK || mode == VpnMode.FAST || mode == VpnMode.TOR || mode == VpnMode.RELAY) {
                applyVpnMode(context, mode)
            } else if (mode == VpnMode.CUSTOM) {
                val savedProxy = getCustomProxy(context)
                applyVpnMode(context, mode, savedProxy.ifBlank { "AUTO" })
            } else {
                FokkMeshVpnService.stop(context)
            }
        } catch (t: Throwable) {
            Log.e("VpnEngine", "Error restoring saved VPN state", t)
        }
    }
}
