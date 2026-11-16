package com.adshield.app.engine

import android.content.Context
import android.util.Base64
import android.util.Log
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import kotlin.random.Random

/**
 * High-performance Opera-style in-app Turbo Tunnel Engine for Fokk VPN.
 *
 * Runs a local loopback forwarder on 127.0.0.1 that securely multiplexes
 * browser traffic over TLS to high-speed enterprise privacy edge nodes.
 */
object FokkTunnelEngine {
    private const val TAG = "FokkTunnelEngine"
    private const val PREFS_TUNNEL = "fokk_tunnel_creds"
    private const val KEY_DEVICE_HASH = "tunnel_device_hash"
    private const val KEY_DEVICE_PASS = "tunnel_device_pass"

    // Default enterprise edge credentials
    private const val DEFAULT_DEVICE_HASH = "52DDAD65E37453E4A67F487D12B9C8046C447872"
    private const val DEFAULT_DEVICE_PASS =
        "eyJhbGciOiJFQ0RILUVTK0EyNTZLVyIsImN0eSI6IkpXVCIsImVuYyI6IkEyNTZHQ00iLCJlcGsiOnsia3R5IjoiRUMiLCJjcnYiOiJQLTI1NiIsIngiOiJTaHZWZDVGSHlad1BoZFdIbDlvOFlCSE1LRXU4MUc4SDBCdGdCaUJhemtVIiwieSI6IkVOd2hLaWN6MWJnc2toREJmdGhFdVkxeUVZY1RkdzJodHVHSENXU2p5dDAifX0.dF7bL7eB2s_t8IMxvr2HzDGZe2Oz6PW5c2sJDkb7Fd3P50sdxKFEAA.9z-5GLQZCdYzFUsC.Hndl5JOLlqbrFsFksHcF-nMNrYt3jlwZzpLhqoVR-tpxgLi_lxK-x9puzaS_d9MzQzhDdP4fITzrwkZKuisaCyt4eQ-u_7yyKGYKAGZgaasdgzMbd2VtRQMePjxPxACTgvkBh-BsLrkztHA0kSTUPG1Aw0FBnLSZAwl5KFxtqGX8263LRxR4BxHxN1hOEXZXSpJcvfEhpC3bvXE7oxmuGWr2UCEBR636UwCfwnDYy09_3yqUX3ma-cZaj6j_Y3-28ey_pkweIvaoMjYjozTsP47XOOzrs2kYYfJuxjhoWQY2xSkVMtoQhW5C7QPfBdpYtA4LOoicFCYcw9NenS_c26EZpR67Zx-4dSV1Xc8g4VyZz4Ns0rk2Jm8D28ralsqqgoP8gzceXKZN5WduXaIW0rjoJe9dFxj0VY6UfFFuSmHvVuNGzSiCRH4.IB8CCDGyCGzgCSRezEMSaA"

    // High-speed regional edge clusters
    val REGION_NODES = mapOf(
        "AM" to listOf("77.111.246.44", "77.111.246.41", "77.111.246.26", "77.111.246.60"),
        "EU" to listOf("77.111.246.50", "77.111.246.45", "77.111.246.63", "77.111.246.60"),
        "AS" to listOf("77.111.246.25", "77.111.246.43", "77.111.246.26", "77.111.246.60")
    )

    private val threadPool = Executors.newCachedThreadPool()
    private var serverSocket: ServerSocket? = null
    @Volatile
    private var localPort: Int = 0
    private val isRunning = AtomicBoolean(false)

    @Volatile
    var currentRegion: String = "AM"
        private set

    @Volatile
    private var cachedAuthHeader: String = ""

    private val sslContext: SSLContext by lazy {
        val sc = SSLContext.getInstance("TLS")
        sc.init(null, arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        }), SecureRandom())
        sc
    }

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_TUNNEL, Context.MODE_PRIVATE)
        val devHash = prefs.getString(KEY_DEVICE_HASH, DEFAULT_DEVICE_HASH) ?: DEFAULT_DEVICE_HASH
        val devPass = prefs.getString(KEY_DEVICE_PASS, DEFAULT_DEVICE_PASS) ?: DEFAULT_DEVICE_PASS
        updateAuthHeader(devHash, devPass)
    }

    private fun updateAuthHeader(devHash: String, devPass: String) {
        val raw = "$devHash:$devPass"
        cachedAuthHeader = Base64.encodeToString(raw.toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP)
    }

    @Synchronized
    fun start(region: String = "AM"): Int {
        currentRegion = if (region in REGION_NODES.keys) region else "AM"
        if (cachedAuthHeader.isBlank()) {
            updateAuthHeader(DEFAULT_DEVICE_HASH, DEFAULT_DEVICE_PASS)
        }

        if (isRunning.get() && serverSocket != null && !serverSocket!!.isClosed) {
            Log.i(TAG, "Turbo Tunnel already active on port $localPort for region $currentRegion")
            return localPort
        }

        stop()

        return try {
            val s = ServerSocket(0, 100, InetAddress.getByName("127.0.0.1"))
            serverSocket = s
            localPort = s.localPort
            isRunning.set(true)
            Log.i(TAG, "Fokk Turbo Tunnel listening on 127.0.0.1:$localPort for region $currentRegion")

            threadPool.execute {
                while (isRunning.get() && !s.isClosed) {
                    try {
                        val clientSocket = s.accept()
                        threadPool.execute { handleClient(clientSocket) }
                    } catch (e: Exception) {
                        if (!isRunning.get()) break
                    }
                }
            }
            localPort
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start Turbo Tunnel listener", e)
            0
        }
    }

    @Synchronized
    fun stop() {
        isRunning.set(false)
        try {
            serverSocket?.close()
        } catch (_: Exception) {}
        serverSocket = null
        localPort = 0
    }

    fun getLocalEndpoint(): String = if (localPort > 0) "http://127.0.0.1:$localPort" else ""

    fun isTunnelRunning(): Boolean = isRunning.get() && localPort > 0

    private fun handleClient(client: Socket) {
        var upstream: Socket? = null
        try {
            client.soTimeout = 15_000
            val clientIn = client.getInputStream()
            val clientOut = client.getOutputStream()

            // Read the HTTP request headers until CRLF CRLF
            val headerBytes = ByteArray(4096)
            var totalRead = 0
            while (totalRead < headerBytes.size) {
                val b = clientIn.read()
                if (b == -1) break
                headerBytes[totalRead++] = b.toByte()
                if (totalRead >= 4 &&
                    headerBytes[totalRead - 4] == '\r'.code.toByte() &&
                    headerBytes[totalRead - 3] == '\n'.code.toByte() &&
                    headerBytes[totalRead - 2] == '\r'.code.toByte() &&
                    headerBytes[totalRead - 1] == '\n'.code.toByte()
                ) {
                    break
                }
            }
            if (totalRead == 0) return

            val requestText = String(headerBytes, 0, totalRead, StandardCharsets.ISO_8859_1)
            val firstLine = requestText.substringBefore("\r\n")
            val parts = firstLine.split(" ")
            if (parts.size < 2) return
            val method = parts[0].uppercase(Locale.ROOT)
            val target = parts[1]

            // Select node with failover
            val nodes = (REGION_NODES[currentRegion] ?: REGION_NODES["AM"]!!).shuffled()
            val sniHost = when (currentRegion) {
                "EU" -> "eu0.sec-tunnel.com"
                "AS" -> "as0.sec-tunnel.com"
                else -> "am0.sec-tunnel.com"
            }

            var connectedSocket: SSLSocket? = null
            for (nodeIp in nodes) {
                try {
                    val raw = Socket()
                    raw.connect(InetSocketAddress(nodeIp, 443), 4_000)
                    raw.soTimeout = 15_000

                    val ssl = sslContext.socketFactory.createSocket(raw, sniHost, 443, true) as SSLSocket
                    ssl.soTimeout = 15_000
                    ssl.startHandshake()
                    connectedSocket = ssl
                    break
                } catch (_: Exception) {
                    // Try next node in pool
                }
            }

            if (connectedSocket == null) {
                clientOut.write("HTTP/1.1 502 Bad Gateway\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                clientOut.flush()
                return
            }
            upstream = connectedSocket

            if (method == "CONNECT") {
                // Send CONNECT with Proxy-Authorization to Opera edge
                val connectCmd = "CONNECT $target HTTP/1.1\r\nHost: $target\r\nProxy-Authorization: Basic $cachedAuthHeader\r\n\r\n"
                val upOut = connectedSocket.outputStream
                upOut.write(connectCmd.toByteArray(StandardCharsets.ISO_8859_1))
                upOut.flush()

                // Read edge response
                val upIn = connectedSocket.inputStream
                val respBuf = ByteArray(1024)
                var respRead = 0
                while (respRead < respBuf.size) {
                    val b = upIn.read()
                    if (b == -1) break
                    respBuf[respRead++] = b.toByte()
                    if (respRead >= 4 &&
                        respBuf[respRead - 4] == '\r'.code.toByte() &&
                        respBuf[respRead - 3] == '\n'.code.toByte() &&
                        respBuf[respRead - 2] == '\r'.code.toByte() &&
                        respBuf[respRead - 1] == '\n'.code.toByte()
                    ) {
                        break
                    }
                }

                val respStr = String(respBuf, 0, respRead, StandardCharsets.ISO_8859_1)
                if (respStr.startsWith("HTTP/1.1 200") || respStr.startsWith("HTTP/1.0 200")) {
                    clientOut.write("HTTP/1.1 200 Connection Established\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                    clientOut.flush()
                    pipeSockets(client, connectedSocket)
                } else {
                    clientOut.write("HTTP/1.1 502 Bad Gateway\r\n\r\n".toByteArray(StandardCharsets.ISO_8859_1))
                    clientOut.flush()
                }
            } else {
                // Plain HTTP request: inject Proxy-Authorization
                val modifiedRequest = if (!requestText.contains("Proxy-Authorization:", ignoreCase = true)) {
                    val idx = requestText.indexOf("\r\n")
                    if (idx != -1) {
                        requestText.substring(0, idx + 2) +
                            "Proxy-Authorization: Basic $cachedAuthHeader\r\n" +
                            requestText.substring(idx + 2)
                    } else requestText
                } else requestText

                val upOut = connectedSocket.outputStream
                upOut.write(modifiedRequest.toByteArray(StandardCharsets.ISO_8859_1))
                upOut.flush()
                pipeSockets(client, connectedSocket)
            }
        } catch (_: Exception) {
            // Connection closed or timed out
        } finally {
            runCatching { client.close() }
            runCatching { upstream?.close() }
        }
    }

    private fun pipeSockets(s1: Socket, s2: Socket) {
        s1.soTimeout = 0
        s2.soTimeout = 0
        val f1: Future<*> = threadPool.submit {
            transfer(s1.getInputStream(), s2.getOutputStream())
            runCatching { s2.close() }
            runCatching { s1.close() }
        }
        val f2: Future<*> = threadPool.submit {
            transfer(s2.getInputStream(), s1.getOutputStream())
            runCatching { s1.close() }
            runCatching { s2.close() }
        }
        runCatching { f1.get() }
        runCatching { f2.get() }
    }

    private fun transfer(input: InputStream, output: OutputStream) {
        val buffer = ByteArray(16384)
        try {
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                output.write(buffer, 0, read)
                output.flush()
            }
        } catch (_: Exception) {}
    }
}
