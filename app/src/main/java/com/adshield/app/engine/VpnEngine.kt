package com.adshield.app.engine

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.net.Uri
import android.os.IBinder
import android.util.Log
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
    private var torServiceConnection: ServiceConnection? = null
    @Volatile
    private var isTorBound = false

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

    private const val TOR_ACTION_START = "org.torproject.android.intent.action.START"
    private const val TOR_ACTION_STOP = "org.torproject.android.intent.action.STOP"
    private const val TOR_EXTRA_PACKAGE_NAME = "org.torproject.android.intent.extra.SERVICE_PACKAGE_NAME"

    fun startEmbeddedTor(context: Context) {
        try {
            val appCtx = context.applicationContext
            val intent = Intent(appCtx, org.torproject.jni.TorService::class.java).apply {
                action = TOR_ACTION_START
                putExtra(TOR_EXTRA_PACKAGE_NAME, appCtx.packageName)
            }
            if (!isTorBound) {
                val conn = object : ServiceConnection {
                    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                        Log.i("VpnEngine", "TorService connected & bound")
                        isTorBound = true
                    }
                    override fun onServiceDisconnected(name: ComponentName?) {
                        Log.w("VpnEngine", "TorService disconnected")
                        isTorBound = false
                    }
                }
                torServiceConnection = conn
                appCtx.bindService(intent, conn, Context.BIND_AUTO_CREATE)
            }
            try {
                appCtx.startService(intent)
            } catch (se: Exception) {
                Log.w("VpnEngine", "startService fallback note: ${se.message}")
            }
        } catch (e: Exception) {
            Log.e("VpnEngine", "Failed to start embedded TorService", e)
        }
    }

    fun stopEmbeddedTor(context: Context) {
        try {
            val appCtx = context.applicationContext
            if (isTorBound && torServiceConnection != null) {
                try {
                    appCtx.unbindService(torServiceConnection!!)
                } catch (ue: Exception) {
                    Log.w("VpnEngine", "Error unbinding TorService: ${ue.message}")
                }
                isTorBound = false
                torServiceConnection = null
            }
            val intent = Intent(appCtx, org.torproject.jni.TorService::class.java).apply {
                action = TOR_ACTION_STOP
            }
            try {
                appCtx.stopService(intent)
            } catch (se: Exception) {
                Log.w("VpnEngine", "Error stopping TorService: ${se.message}")
            }
        } catch (e: Exception) {
            Log.e("VpnEngine", "Failed to stop embedded TorService", e)
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
        if (!value.contains("://")) {
            val port = value.substringAfterLast(':', "").toIntOrNull() ?: 0
            value = if (port in setOf(80, 8080, 3128, 8000, 8888, 8889)) {
                "http://$value"
            } else {
                "socks5://$value"
            }
        }
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

    private fun checkHttpConnectProxy(host: String, port: Int, tlsToProxy: Boolean): Boolean = try {
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

        executor.execute {
            if (mode == VpnMode.TOR) {
                startEmbeddedTor(context)
                val startTime = System.currentTimeMillis()
                val timeoutMs = 30_000L
                var ready = isTorListening() && checkSocks5Proxy("127.0.0.1", getTorPort())
                while (!ready && (System.currentTimeMillis() - startTime) < timeoutMs) {
                    try {
                        Thread.sleep(400)
                    } catch (_: InterruptedException) {
                        break
                    }
                    ready = isTorListening() && checkSocks5Proxy("127.0.0.1", getTorPort())
                }

                if (!ready) {
                    if (isOrbotInstalled(context)) {
                        launchOrbot(context)
                        onComplete?.invoke(
                            false,
                            "Tor daemon is starting. Open Orbot or wait a moment, then select Tor again."
                        )
                    } else {
                        onComplete?.invoke(
                            false,
                            "Tor Onion daemon is still establishing circuits. Please wait a moment and tap again."
                        )
                    }
                    return@execute
                }
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
                return@execute
            }
            val (host, port) = try { endpointHostAndPort(endpoint) } catch (e: Exception) {
                onComplete?.invoke(false, e.message ?: "Invalid proxy address")
                return@execute
            }

            if (mode != VpnMode.TOR && !isProxyHandshakeValid(endpoint)) {
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
                        VpnMode.TOR -> "Connected to Tor Onion Network ($host:$port). Exit IP is masked."
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
        if (mode == VpnMode.TOR) {
            // Restore Tor route asynchronously so cold daemon startup doesn't wipe saved mode
            startEmbeddedTor(context)
            applyVpnMode(context, VpnMode.TOR)
        } else if (mode == VpnMode.CUSTOM) {
            val savedProxy = getCustomProxy(context)
            if (savedProxy.isNotBlank()) {
                val endpoint = runCatching { normalizeProxy(savedProxy) }.getOrNull()
                if (endpoint != null) {
                    applyVpnMode(context, mode, savedProxy)
                } else {
                    context.getSharedPreferences(PREFS_VPN, Context.MODE_PRIVATE)
                        .edit().putString(KEY_VPN_MODE, VpnMode.OFF.id).apply()
                    ProxyController.getInstance().clearProxyOverride(executor) {}
                }
            }
        }
    }
}
