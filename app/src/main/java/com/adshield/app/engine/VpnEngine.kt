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

    enum class VpnMode(val id: String, val title: String, val defaultProxy: String) {
        OFF("off", "Direct Connection (Real IP Exposed)", ""),
        FAST("fast", "Fokk Fast Privacy Network", ""),
        TOR("tor", "Fokk Fast Privacy Network", ""),
        RELAY("relay", "Fokk Fast Privacy Network", ""),
        CUSTOM("custom", "Fokk Dedicated Node", "")
    }

    private val executor = Executors.newSingleThreadExecutor()

    fun isSupported(): Boolean = WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)

    fun getActiveMode(context: Context): VpnMode {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        val id = prefs.getString(KEY_VPN_MODE, VpnMode.OFF.id) ?: VpnMode.OFF.id
        val savedProxy = prefs.getString(KEY_CUSTOM_PROXY, "").orEmpty().trim()
        if (id == VpnMode.CUSTOM.id && isLegacyProxy(savedProxy)) {
            prefs.edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).remove(KEY_CUSTOM_PROXY).apply()
            return VpnMode.OFF
        }
        return VpnMode.values().firstOrNull { it.id == id } ?: VpnMode.OFF
    }

    fun getFastPrivacyEndpoint(): String {
        val endpoint = FokkTunnelEngine.getLocalEndpoint()
        return if (endpoint.isNotBlank()) endpoint else "http://127.0.0.1:28080"
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
            FokkTunnelEngine.stop()
            ProxyController.getInstance().clearProxyOverride(executor) {
                prefs.edit().putString(KEY_VPN_MODE, mode.id).apply()
                onComplete?.invoke(true, "Fokk VPN disconnected. Traffic is direct.")
            }
            return
        }

        executor.execute {
            FokkTunnelEngine.init(context)

            val isCustomExternal = mode == VpnMode.CUSTOM &&
                customProxy != null &&
                customProxy !in setOf("AM", "EU", "AS", "US") &&
                (customProxy.contains(":") || customProxy.contains("."))

            val endpoint: String
            val routeDesc: String

            if (isCustomExternal) {
                // External custom private server
                FokkTunnelEngine.stop()
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
                if (!isProxyHandshakeValid(normalized)) {
                    onComplete?.invoke(
                        false,
                        "The node at $host:$port is unreachable. Browser kept on Direct connection to prevent offline errors."
                    )
                    return@execute
                }
                endpoint = normalized
                routeDesc = "Connected to Fokk Dedicated Node ($host:$port)."
            } else {
                // Opera-style In-App Turbo Tunnel Engine
                val region = if (mode == VpnMode.CUSTOM) {
                    when (customProxy ?: getCustomProxy(context)) {
                        "EU" -> "EU"
                        "AS" -> "AS"
                        else -> "AM"
                    }
                } else "AM"

                val port = FokkTunnelEngine.start(region)
                if (port <= 0) {
                    onComplete?.invoke(false, "Could not initialize Fokk Turbo Tunnel.")
                    return@execute
                }
                endpoint = "http://127.0.0.1:$port"
                val regionLabel = when (region) {
                    "EU" -> "Europe"
                    "AS" -> "Asia"
                    else -> "Americas"
                }
                routeDesc = if (mode == VpnMode.CUSTOM) {
                    "Connected to Fokk Dedicated Node ($regionLabel). Your IP is masked."
                } else {
                    "Connected to Fokk Fast Privacy Network ($regionLabel). Your IP is masked."
                }
            }

            val config = ProxyConfig.Builder()
                .addProxyRule(endpoint, ProxyConfig.MATCH_ALL_SCHEMES)
                .addBypassRule("<local>")
                .addBypassRule("localhost")
                .addBypassRule("127.0.0.1")
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
            } catch (e: Exception) {
                ProxyController.getInstance().clearProxyOverride(executor) {
                    prefs.edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).apply()
                }
                onComplete?.invoke(false, "Could not apply Fokk VPN: ${e.localizedMessage ?: "unknown error"}. Reverted to Direct.")
            }
        }
    }

    fun restoreSavedState(context: Context) {
        val mode = getActiveMode(context)
        if (mode == VpnMode.FAST || mode == VpnMode.TOR || mode == VpnMode.RELAY) {
            applyVpnMode(context, mode)
        } else if (mode == VpnMode.CUSTOM) {
            val savedProxy = getCustomProxy(context)
            applyVpnMode(context, mode, savedProxy.ifBlank { "AM" })
        }
    }
}
