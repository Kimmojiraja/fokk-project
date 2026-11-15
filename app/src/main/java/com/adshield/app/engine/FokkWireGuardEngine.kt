package com.adshield.app.engine

import android.content.Context
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config

/**
 * Fokk's full-device WireGuard runtime.
 *
 * Server profiles are supplied by Fokk Pro provisioning (or imported during
 * development). The WireGuard backend owns Android's VpnService and routes the
 * device through the encrypted tunnel once Android's VPN consent is granted.
 */
class FokkWireGuardEngine(context: Context) {
    private val appContext = context.applicationContext
    private val backend by lazy { GoBackend(appContext) }
    private var activeConfig: Config? = null

    private val tunnel = object : Tunnel {
        override fun getName(): String = "fokk-pro"
        override fun onStateChange(newState: Tunnel.State) = Unit
    }

    fun connect(configText: String): Result<Unit> = runCatching {
        require(configText.contains("[Interface]", ignoreCase = true) && configText.contains("[Peer]", ignoreCase = true)) {
            "This is not a complete WireGuard profile."
        }
        val config = Config.parse(configText.byteInputStream())
        backend.setState(tunnel, Tunnel.State.UP, config)
        activeConfig = config
    }

    fun disconnect(): Result<Unit> = runCatching {
        backend.setState(tunnel, Tunnel.State.DOWN, null)
        activeConfig = null
    }

    fun isConnected(): Boolean = backend.getState(tunnel) == Tunnel.State.UP && activeConfig != null
}
