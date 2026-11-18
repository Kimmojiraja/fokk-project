package com.adshield.app.engine

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.ProxyInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import com.adshield.app.AdShieldApp
import com.adshield.app.R
import com.adshield.app.ui.MediaHubActivity
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Fokk Mesh 3.0 Device-Wide Service (Android 10+ HTTP/HTTPS Mesh + Real UDP/53 DNS Forwarder).
 *
 * Fixes from v2.x:
 *   - Guards Android <10 (API <29) where setHttpProxy is unavailable so it never blackholes the device.
 *   - Replaces the previous no-op packet drop loop with a real IPv4 UDP/53 DNS forwarder using
 *     protect()ed sockets so system/app DNS queries resolve cleanly while HTTP/HTTPS traffic
 *     routes through FokkTunnelEngine (127.0.0.1:<localPort>).
 */
class FokkMeshVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private val isRunning = AtomicBoolean(false)
    private var tunnelThread: Thread? = null
    private val dnsExecutor = Executors.newFixedThreadPool(4) { r ->
        Thread(r, "fokk-mesh-dns").also { it.isDaemon = true }
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "FokkMeshVpnService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        when (action) {
            ACTION_DISCONNECT -> {
                disconnectMesh()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                val region = intent?.getStringExtra(EXTRA_REGION) ?: "AUTO"
                runCatching {
                    startForeground(NOTIFICATION_ID, buildNotification(region))
                }
                Thread({
                    startMesh(region)
                }, "FokkMeshStartWorker").apply {
                    isDaemon = true
                    start()
                }
                return START_STICKY
            }
        }
        return START_NOT_STICKY
    }

    private fun startMesh(region: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Log.w(TAG, "Device-wide HTTP/HTTPS Fokk Mesh requires Android 10+ (API 29)")
            disconnectMesh()
            return
        }

        if (isRunning.get() && vpnInterface != null) {
            updateNotification(region)
            return
        }

        try {
            val isPro = VpnEngine.isProModeEnabled(this)
            FokkTunnelEngine.isProMode = isPro
            FokkTunnelEngine.start(this, region)
            val deadline = System.currentTimeMillis() + 2_000
            while (FokkTunnelEngine.localPort <= 0 && System.currentTimeMillis() < deadline) {
                Thread.sleep(50)
            }
            val localPort = FokkTunnelEngine.localPort
            if (localPort <= 0) {
                Log.e(TAG, "Failed to start local Fokk Tunnel Engine")
                disconnectMesh()
                return
            }

            val builder = Builder()
                .setSession("Fokk Mesh (Device-Wide)")
                .setMtu(1500)
                .addAddress("10.233.0.2", 24)
                .addDnsServer("10.233.0.1")
                .addRoute("10.233.0.1", 32)
                .setMetered(false)

            // Prevent routing loopback for Fokk Browser's own relay sockets
            runCatching {
                builder.addDisallowedApplication(packageName)
            }

            // Route Android 10+ system-wide HTTP/HTTPS traffic through FokkTunnelEngine
            builder.setHttpProxy(ProxyInfo.buildDirectProxy("127.0.0.1", localPort))

            val pfd = builder.establish()
            if (pfd == null) {
                Log.e(TAG, "Failed to establish Fokk Mesh interface")
                disconnectMesh()
                return
            }

            vpnInterface = pfd
            isRunning.set(true)
            isServiceRunning = true

            runCatching {
                startForeground(NOTIFICATION_ID, buildNotification(region))
            }

            startPacketPump(pfd)
            Log.i(TAG, "Fokk Mesh device-wide service active [Region: $region, Port: $localPort]")
        } catch (e: Exception) {
            Log.e(TAG, "Error establishing Fokk Mesh device-wide service", e)
            disconnectMesh()
        }
    }

    /**
     * Reads IPv4 packets from TUN and forwards UDP/53 DNS queries through protected
     * sockets so system DNS resolves cleanly instead of blackholing.
     */
    private fun startPacketPump(pfd: ParcelFileDescriptor) {
        val outLock = Any()
        tunnelThread = Thread({
            val inStream = FileInputStream(pfd.fileDescriptor)
            val outStream = FileOutputStream(pfd.fileDescriptor)
            val buffer = ByteArray(32768)

            try {
                while (isRunning.get()) {
                    val read = inStream.read(buffer)
                    if (read <= 0) {
                        Thread.sleep(10)
                        continue
                    }
                    // Check IPv4 (version == 4) and UDP (protocol == 17)
                    val version = (buffer[0].toInt() ushr 4) and 0x0F
                    if (version != 4 || read < 28) continue
                    val ihl = (buffer[0].toInt() and 0x0F) * 4
                    if (ihl < 20 || read < ihl + 8) continue
                    val protocol = buffer[9].toInt() and 0xFF
                    if (protocol != 17) continue

                    val dstPort = ((buffer[ihl + 2].toInt() and 0xFF) shl 8) or (buffer[ihl + 3].toInt() and 0xFF)
                    if (dstPort != 53) continue

                    val srcPort = ((buffer[ihl].toInt() and 0xFF) shl 8) or (buffer[ihl + 1].toInt() and 0xFF)
                    val udpLen = ((buffer[ihl + 4].toInt() and 0xFF) shl 8) or (buffer[ihl + 5].toInt() and 0xFF)
                    val payloadLen = udpLen - 8
                    if (payloadLen <= 0 || ihl + 8 + payloadLen > read) continue

                    val srcIp = buffer.copyOfRange(12, 16)
                    val dstIp = buffer.copyOfRange(16, 20)
                    val dnsQuery = buffer.copyOfRange(ihl + 8, ihl + 8 + payloadLen)

                    dnsExecutor.submit {
                        forwardDnsQuery(dnsQuery, srcIp, dstIp, srcPort, dstPort, outStream, outLock)
                    }
                }
            } catch (_: Exception) {
            } finally {
                runCatching { inStream.close() }
                runCatching { outStream.close() }
            }
        }, "FokkMeshTunDnsPump").apply {
            isDaemon = true
            start()
        }
    }

    private fun forwardDnsQuery(
        dnsQuery: ByteArray,
        clientIp: ByteArray,
        dnsServerIp: ByteArray,
        clientPort: Int,
        serverPort: Int,
        outStream: FileOutputStream,
        outLock: Any
    ) {
        var sock: DatagramSocket? = null
        try {
            sock = DatagramSocket()
            if (!protect(sock)) {
                sock.close()
                return
            }
            sock.soTimeout = 3_000
            val targetAddr = InetAddress.getByAddress(dnsServerIp)
            sock.send(DatagramPacket(dnsQuery, dnsQuery.size, targetAddr, serverPort))

            val respBuf = ByteArray(2048)
            val respPacket = DatagramPacket(respBuf, respBuf.size)
            sock.receive(respPacket)
            val dnsRespLen = respPacket.length
            if (dnsRespLen <= 0 || !isRunning.get()) return

            // Build IPv4 (20B) + UDP (8B) + DNS response packet
            val totalLen = 20 + 8 + dnsRespLen
            val pkt = ByteArray(totalLen)
            pkt[0] = 0x45.toByte()                          // IPv4, IHL=5 (20 bytes)
            pkt[1] = 0x00                                   // DSCP/ECN
            pkt[2] = ((totalLen ushr 8) and 0xFF).toByte()
            pkt[3] = (totalLen and 0xFF).toByte()
            pkt[4] = 0x00; pkt[5] = 0x01                    // ID
            pkt[6] = 0x40; pkt[7] = 0x00                    // DF
            pkt[8] = 64.toByte()                            // TTL
            pkt[9] = 17.toByte()                            // UDP
            // Src = dnsServerIp, Dst = clientIp
            System.arraycopy(dnsServerIp, 0, pkt, 12, 4)
            System.arraycopy(clientIp, 0, pkt, 16, 4)

            // IPv4 header checksum
            val checksum = computeIpv4Checksum(pkt, 0, 20)
            pkt[10] = ((checksum ushr 8) and 0xFF).toByte()
            pkt[11] = (checksum and 0xFF).toByte()

            // UDP header
            val udpTotal = 8 + dnsRespLen
            pkt[20] = ((serverPort ushr 8) and 0xFF).toByte()
            pkt[21] = (serverPort and 0xFF).toByte()
            pkt[22] = ((clientPort ushr 8) and 0xFF).toByte()
            pkt[23] = (clientPort and 0xFF).toByte()
            pkt[24] = ((udpTotal ushr 8) and 0xFF).toByte()
            pkt[25] = (udpTotal and 0xFF).toByte()
            pkt[26] = 0x00; pkt[27] = 0x00                  // Optional in IPv4 UDP

            System.arraycopy(respBuf, 0, pkt, 28, dnsRespLen)

            synchronized(outLock) {
                if (isRunning.get()) {
                    outStream.write(pkt)
                }
            }
        } catch (_: Exception) {
        } finally {
            runCatching { sock?.close() }
        }
    }

    private fun computeIpv4Checksum(buf: ByteArray, offset: Int, length: Int): Int {
        var sum = 0
        var i = offset
        while (i < offset + length) {
            if (i != offset + 10) {
                val word = ((buf[i].toInt() and 0xFF) shl 8) or (buf[i + 1].toInt() and 0xFF)
                sum += word
                if ((sum and 0xFFFF0000.toInt()) != 0) {
                    sum = (sum and 0xFFFF) + (sum ushr 16)
                }
            }
            i += 2
        }
        return sum.inv() and 0xFFFF
    }

    private fun updateNotification(region: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        nm?.notify(NOTIFICATION_ID, buildNotification(region))
    }

    private fun buildNotification(region: String): Notification {
        val regionLabel = VpnEngine.getRegionDisplayName(region)

        val openIntent = Intent(this, MediaHubActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("open_vpn_sheet", true)
        }
        val openPending = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val disconnectIntent = Intent(this, FokkMeshVpnService::class.java).apply {
            action = ACTION_DISCONNECT
        }
        val disconnectPending = PendingIntent.getService(
            this,
            1,
            disconnectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, AdShieldApp.CHANNEL_ID_VPN)
            .setSmallIcon(R.drawable.ic_shield_check)
            .setContentTitle("Fokk Mesh Active · $regionLabel")
            .setContentText("Device HTTP/HTTPS routed via Fokk Mesh with live DNS protection")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openPending)
            .addAction(R.drawable.ic_close, "Disconnect", disconnectPending)
            .build()
    }

    private fun disconnectMesh() {
        isRunning.set(false)
        isServiceRunning = false

        runCatching { tunnelThread?.interrupt() }
        tunnelThread = null

        runCatching { vpnInterface?.close() }
        vpnInterface = null

        runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
        runCatching { stopSelf() }

        runCatching { VpnEngine.onDeviceMeshStopped(this) }

        runCatching {
            sendBroadcast(Intent(ACTION_MESH_STATE_CHANGED).apply {
                setPackage(packageName)
                putExtra("is_connected", false)
            })
        }

        Log.i(TAG, "Fokk Mesh device-wide service stopped")
    }

    override fun onDestroy() {
        disconnectMesh()
        runCatching { dnsExecutor.shutdownNow() }
        super.onDestroy()
    }

    override fun onRevoke() {
        disconnectMesh()
        super.onRevoke()
    }

    companion object {
        private const val TAG = "FokkMeshVpnService"
        const val NOTIFICATION_ID = 4001
        const val ACTION_START = "com.adshield.app.action.START_FOKK_MESH"
        const val ACTION_DISCONNECT = "com.adshield.app.action.DISCONNECT_FOKK_MESH"
        const val ACTION_MESH_STATE_CHANGED = "com.adshield.app.action.FOKK_MESH_STATE_CHANGED"
        const val EXTRA_REGION = "extra_region"

        @Volatile
        var isServiceRunning = false
            private set

        fun start(context: Context, region: String = "AUTO") {
            runCatching {
                val appContext = context.applicationContext
                val intent = Intent(appContext, FokkMeshVpnService::class.java).apply {
                    action = ACTION_START
                    putExtra(EXTRA_REGION, region)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    appContext.startForegroundService(intent)
                } else {
                    appContext.startService(intent)
                }
            }
        }

        fun stop(context: Context) {
            runCatching {
                val appContext = context.applicationContext
                val intent = Intent(appContext, FokkMeshVpnService::class.java).apply {
                    action = ACTION_DISCONNECT
                }
                appContext.startService(intent)
            }
        }
    }
}
