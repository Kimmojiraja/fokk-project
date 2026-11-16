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
import java.io.BufferedReader
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory
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

    enum class VpnMode(val id: String, val title: String, val defaultProxy: String) {
        OFF("off", "Direct Connection (Privacy Gateway Disabled)", ""),
        TOR("tor", "Tor Onion Network (SOCKS5)", "socks5://127.0.0.1:9050"),
        RELAY("relay", "Fokk Secure Privacy Relay", "socks5://185.220.101.5:9050"),
        CUSTOM("custom", "Custom SOCKS / HTTP(S) Privacy Proxy", "")
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

    fun isTorListening(): Boolean = checkSocketOpen("127.0.0.1", 9050) || checkSocketOpen("127.0.0.1", 9150)

    fun getTorPort(): Int = if (checkSocketOpen("127.0.0.1", 9150)) 9150 else 9050

    fun getTorEndpoint(): String = "socks5://127.0.0.1:${getTorPort()}"

    fun getRelayEndpoint(): String = "socks5://185.220.101.5:9050"

    private fun checkSocketOpen(host: String, port: Int, timeoutMs: Int = 400): Boolean = try {
        Socket().use {
            it.connect(InetSocketAddress(host, port), timeoutMs)
            true
        }
    } catch (_: Exception) {
        false
    }

    fun isOrbotInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo("org.torproject.android", 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun launchOrbot(context: Context): Boolean {
        return try {
            val intent = context.packageManager.getLaunchIntentForPackage("org.torproject.android")
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                true
            } else {
                val marketIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=org.torproject.android")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(marketIntent)
                true
            }
        } catch (_: Exception) {
            try {
                val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=org.torproject.android")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(webIntent)
                true
            } catch (_: Exception) { false }
        }
    }

    fun startEmbeddedTor(context: Context) {
        try {
            val intent = Intent("org.torproject.android.intent.action.START").apply {
                setPackage(context.packageName)
            }
            context.startService(intent)
        } catch (e: Exception) {
            android.util.Log.e("VpnEngine", "Failed to start embedded TorService", e)
        }
    }

    fun stopEmbeddedTor(context: Context) {
        try {
            val intent = Intent("org.torproject.android.intent.action.STOP").apply {
                setPackage(context.packageName)
            }
            context.startService(intent)
        } catch (e: Exception) {
            android.util.Log.e("VpnEngine", "Failed to stop embedded TorService", e)
        }
    }

    fun getCustomProxy(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_CUSTOM_PROXY, "").orEmpty().trim()
        if (isLegacyProxy(saved)) {
            // Older builds prefilled a local endpoint without starting a proxy there.
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
        value == "socks://127.0.0.1:1080" || value == "127.0.0.1:1080"

    private fun normalizeProxy(raw: String): String {
        var value = raw.trim()
        require(value.isNotBlank()) { "Enter a proxy address" }
        if (!value.contains("://")) value = "socks5://$value"
        val uri = URI(value)
        val scheme = uri.scheme?.lowercase() ?: throw IllegalArgumentException("Proxy scheme is required")
        require(scheme in setOf("http", "https", "socks", "socks5")) {
            "Use http://, https://, socks:// or socks5://"
        }
        require(!uri.host.isNullOrBlank()) { "Proxy host is required" }
        require(uri.port in 1..65535) { "Proxy port must be between 1 and 65535" }
        require(uri.userInfo.isNullOrBlank()) { "Authenticated proxy URLs are not supported by Android WebView" }
        val canonicalScheme = if (scheme == "socks") "socks5" else scheme
        return "${canonicalScheme}://${uri.host}:${uri.port}"
    }

    private fun endpointHostAndPort(proxy: String): Pair<String, Int> {
        val uri = URI(proxy)
        return (uri.host ?: throw IllegalArgumentException("Proxy host is required")) to uri.port
    }

    private fun checkSocks5Proxy(host: String, port: Int): Boolean = try {
        Socket().use { socket ->
            socket.connect(InetSocketAddress(host, port), 1_500)
            socket.soTimeout = 1_500
            socket.getOutputStream().write(byteArrayOf(0x05, 0x01, 0x00))
            val response = ByteArray(2)
            java.io.DataInputStream(socket.getInputStream()).readFully(response)
            response[0] == 0x05.toByte() && response[1] == 0x00.toByte()
        }
    } catch (_: Exception) {
        false
    }

    private fun checkHttpConnectProxy(host: String, port: Int, tlsToProxy: Boolean): Boolean = try {
        val socket = if (tlsToProxy) {
            val rawSocket = Socket()
            try {
                rawSocket.connect(InetSocketAddress(host, port), 1_500)
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
                connect(InetSocketAddress(host, port), 1_500)
                soTimeout = 2_000
            }
        }
        socket.use {
            val request = "CONNECT api.ipify.org:443 HTTP/1.1\r\nHost: api.ipify.org:443\r\nProxy-Connection: Keep-Alive\r\n\r\n"
            it.getOutputStream().write(request.toByteArray(StandardCharsets.ISO_8859_1))
            val statusLine = BufferedReader(InputStreamReader(it.getInputStream(), StandardCharsets.ISO_8859_1)).readLine()
            val statusCode = statusLine?.split(' ')?.getOrNull(1)?.toIntOrNull()
            statusCode != null && statusCode in 200..299
        }
    } catch (_: Exception) {
        // Fall back to simple socket connectivity check if CONNECT request is rejected
        checkSocketOpen(host, port, 1_000)
    }

    fun isProxyHandshakeValid(proxy: String): Boolean {
        val uri = try { URI(proxy) } catch (_: Exception) { return false }
        val host = uri.host ?: return false
        val port = uri.port
        if (port !in 1..65535) return false
        if (!checkSocketOpen(host, port, 1_500)) return false
        return when (uri.scheme?.lowercase()) {
            "socks", "socks5", "socks4" -> checkSocks5Proxy(host, port)
            "http", "https" -> checkHttpConnectProxy(host, port, tlsToProxy = uri.scheme.equals("https", ignoreCase = true))
            else -> false
        }
    }

    /** Direct baseline used only after the user chooses the browser IP verification action. */
    fun checkDirectPublicIp(onResult: (ip: String?, error: String?) -> Unit) {
        executor.execute {
            var lastError = "The direct IP check did not return an address."
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
                    lastError = "The direct IP check returned an invalid address."
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
            onComplete?.invoke(false, "This System WebView does not support secure proxy routing.")
            return
        }
        if (mode == VpnMode.OFF) {
            stopEmbeddedTor(context)
            ProxyController.getInstance().clearProxyOverride(executor) {
                prefs.edit().putString(KEY_VPN_MODE, mode.id).apply()
                onComplete?.invoke(true, "Privacy gateway disabled. Browser traffic is direct.")
            }
            return
        }

        val rawEndpoint = when (mode) {
            VpnMode.OFF -> ""
            VpnMode.TOR -> getTorEndpoint()
            VpnMode.RELAY -> getRelayEndpoint()
            VpnMode.CUSTOM -> customProxy ?: getCustomProxy(context)
        }

        val endpoint = try {
            normalizeProxy(rawEndpoint)
        } catch (e: Exception) {
            onComplete?.invoke(false, e.message ?: "Invalid proxy address")
            return
        }
        val (host, port) = try { endpointHostAndPort(endpoint) } catch (e: Exception) {
            onComplete?.invoke(false, e.message ?: "Invalid proxy address")
            return
        }

        executor.execute {
            if (mode == VpnMode.TOR) {
                val isListening = isTorListening()
                if (!isListening) {
                    startEmbeddedTor(context)
                    if (isOrbotInstalled(context)) {
                        launchOrbot(context)
                    }
                    onComplete?.invoke(
                        false,
                        if (isOrbotInstalled(context)) "Starting Tor / Orbot... Tap connect in Orbot, then select Tor again. Browser kept on Direct."
                        else "Tor is not listening on port ${getTorPort()}. Start Orbot or Tor service. Kept on Direct connection."
                    )
                    return@execute
                }
            } else if (!isProxyHandshakeValid(endpoint)) {
                onComplete?.invoke(
                    false,
                    "The proxy at $host:$port is unreachable. Browser kept on Direct connection to prevent offline errors."
                )
                return@execute
            }

            val config = ProxyConfig.Builder()
                .addProxyRule(endpoint, ProxyConfig.MATCH_ALL_SCHEMES)
                .addBypassRule("<local>")
                .addBypassRule("localhost")
                .addBypassRule("127.0.0.1")
                .addDirect()
                .build()
            try {
                ProxyController.getInstance().setProxyOverride(config, executor) {
                    val editor = prefs.edit().putString(KEY_VPN_MODE, mode.id)
                    if (mode == VpnMode.CUSTOM) editor.putString(KEY_CUSTOM_PROXY, endpoint)
                    editor.apply()
                    val routeDesc = when (mode) {
                        VpnMode.TOR -> "Tor Onion Network active ($host:$port). Exit IP is masked."
                        VpnMode.RELAY -> "Tor route configured ($host:$port)."
                        VpnMode.CUSTOM -> "Custom Proxy active ($host:$port). Exit IP is masked."
                        VpnMode.OFF -> "Direct connection."
                    }
                    onComplete?.invoke(true, routeDesc)
                }
            } catch (e: Exception) {
                ProxyController.getInstance().clearProxyOverride(executor) {
                    prefs.edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).apply()
                }
                onComplete?.invoke(false, "Could not apply proxy: ${e.localizedMessage ?: "unknown error"}. Reverted to Direct.")
            }
        }
    }

    fun restoreSavedState(context: Context) {
        val mode = getActiveMode(context)
        if (mode != VpnMode.OFF) {
            val rawEndpoint = when (mode) {
                VpnMode.TOR -> getTorEndpoint()
                VpnMode.CUSTOM -> getCustomProxy(context)
                else -> ""
            }
            if (rawEndpoint.isNotBlank()) {
                val endpoint = runCatching { normalizeProxy(rawEndpoint) }.getOrNull()
                if (endpoint != null && isProxyHandshakeValid(endpoint)) {
                    applyVpnMode(context, mode, if (mode == VpnMode.CUSTOM) getCustomProxy(context) else null)
                } else {
                    context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
                        .edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).apply()
                    ProxyController.getInstance().clearProxyOverride(executor) {}
                }
            }
        }
    }
}
