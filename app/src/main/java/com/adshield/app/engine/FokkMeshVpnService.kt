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
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

class FokkMeshVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private val isRunning = AtomicBoolean(false)
    private var tunnelThread: Thread? = null

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
                startMesh(region)
                return START_STICKY
            }
        }
        return START_NOT_STICKY
    }

    private fun startMesh(region: String) {
        if (isRunning.get() && vpnInterface != null) {
            updateNotification(region)
            return
        }

        val isPro = VpnEngine.isProModeEnabled(this)
        FokkTunnelEngine.isProMode = isPro
        FokkTunnelEngine.start(this, region)
        // Wait up to 2 s for the tunnel to bind a port
        val deadline = System.currentTimeMillis() + 2_000
        while (FokkTunnelEngine.localPort <= 0 && System.currentTimeMillis() < deadline) {
            Thread.sleep(50)
        }
        val localPort = FokkTunnelEngine.localPort
        if (localPort <= 0) {
            Log.e(TAG, "Failed to start local Fokk Tunnel Engine")
            stopSelf()
            return
        }

        try {
            val builder = Builder()
                .setSession("Fokk Mesh")
                .setMtu(1500)
                .addAddress("10.233.0.2", 24)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("1.1.1.1")
                .addDnsServer("8.8.8.8")

            // Prevent routing loopback: exclude Fokk Browser's own outgoing tunnel sockets
            runCatching {
                builder.addDisallowedApplication(packageName)
            }

            // Route Android 10+ system-wide HTTP/HTTPS proxy
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.setHttpProxy(ProxyInfo.buildDirectProxy("127.0.0.1", localPort))
            }

            // Establish the virtual TUN interface
            val pfd = builder.establish()
            if (pfd == null) {
                Log.e(TAG, "Failed to establish VPN interface")
                stopSelf()
                return
            }

            vpnInterface = pfd
            isRunning.set(true)
            isServiceRunning = true

            // Start foreground with persistent notification
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    buildNotification(region),
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED
                )
            } else {
                startForeground(NOTIFICATION_ID, buildNotification(region))
            }

            // Start background packet pump for DNS and interface traffic
            startPacketPump(pfd)

            Log.i(TAG, "Fokk Mesh device-wide VPN successfully active [Region: $region, Port: $localPort]")
        } catch (e: Exception) {
            Log.e(TAG, "Error establishing Fokk Mesh VPN", e)
            disconnectMesh()
        }
    }

    private fun startPacketPump(pfd: ParcelFileDescriptor) {
        tunnelThread = Thread({
            val inStream = FileInputStream(pfd.fileDescriptor)
            val outStream = FileOutputStream(pfd.fileDescriptor)
            val buffer = ByteBuffer.allocate(32768)

            try {
                while (isRunning.get()) {
                    val read = inStream.read(buffer.array())
                    if (read <= 0) {
                        Thread.sleep(10)
                        continue
                    }
                }
            } catch (_: Exception) {
            } finally {
                runCatching { inStream.close() }
                runCatching { outStream.close() }
            }
        }, "FokkMeshTunPump").apply {
            isDaemon = true
            start()
        }
    }

    private fun updateNotification(region: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        nm?.notify(NOTIFICATION_ID, buildNotification(region))
    }

    private fun buildNotification(region: String): Notification {
        val regionLabel = VpnEngine.getRegionDisplayName(region)

        // Tap notification to open Fokk Browser
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

        // Disconnect action intent
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
            .setContentTitle("Fokk Mesh Active • $regionLabel")
            .setContentText("All device traffic is encrypted via dual-hop oblivious mesh")
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

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()

        // Inform VpnEngine & UI
        VpnEngine.onDeviceMeshStopped(this)

        // Broadcast to Activity to update UI instantly
        sendBroadcast(Intent(ACTION_MESH_STATE_CHANGED).apply {
            setPackage(packageName)
            putExtra("is_connected", false)
        })

        Log.i(TAG, "Fokk Mesh device-wide VPN stopped")
    }

    override fun onDestroy() {
        disconnectMesh()
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
            val intent = Intent(context, FokkMeshVpnService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_REGION, region)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, FokkMeshVpnService::class.java).apply {
                action = ACTION_DISCONNECT
            }
            context.startService(intent)
        }
    }
}
