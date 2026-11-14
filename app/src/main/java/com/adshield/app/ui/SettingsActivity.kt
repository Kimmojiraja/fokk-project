package com.adshield.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.adshield.app.AdShieldApp
import com.adshield.app.databinding.ActivitySettingsBinding
import com.adshield.app.util.AppUpdateManager

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupCustomRuleButtons()
        setupSearchPrivacy()
        setupPrivateDnsGuide()
        setupVpnSettings()
        setupPersonalizationButtons()
        setupUpdateChecker()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupCustomRuleButtons() {
        binding.btnAddBlacklist.setOnClickListener {
            val domain = binding.editBlacklistDomain.text.toString().trim()
            if (domain.isNotEmpty()) {
                AdShieldApp.instance.blocklistEngine.addCustomBlockedDomain(domain)
                binding.editBlacklistDomain.text?.clear()
                Toast.makeText(this, "Blocked domain: $domain", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnAddWhitelist.setOnClickListener {
            val domain = binding.editWhitelistDomain.text.toString().trim()
            if (domain.isNotEmpty()) {
                AdShieldApp.instance.blocklistEngine.addCustomWhitelistedDomain(domain)
                binding.editWhitelistDomain.text?.clear()
                Toast.makeText(this, "Whitelisted domain: $domain", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupPrivateDnsGuide() {
        binding.btnCopyPrivateDns.setOnClickListener {
            val providers = arrayOf(
                "AdGuard DNS (Recommended: Maximum Ad & Tracker Blocking)\nHostname: dns.adguard-dns.com",
                "NextDNS (Advanced Cloud & Privacy Protection)\nHostname: dns.nextdns.io",
                "Mullvad Adblock (Strict Privacy & Zero Logs)\nHostname: adblock.dns.mullvad.net",
                "Cloudflare Security & Speed (Malware Protection)\nHostname: security.cloudflare-dns.com",
                "Control D Ad Blocker\nHostname: p2.freedns.controld.com"
            )
            val hostnames = arrayOf(
                "dns.adguard-dns.com",
                "dns.nextdns.io",
                "adblock.dns.mullvad.net",
                "security.cloudflare-dns.com",
                "p2.freedns.controld.com"
            )

            AlertDialog.Builder(this)
                .setTitle("Select Mobile Private DNS")
                .setItems(providers) { _, which ->
                    val chosenHost = hostnames[which]
                    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("Private DNS Provider", chosenHost))
                    Toast.makeText(this, "Copied '$chosenHost' to clipboard!", Toast.LENGTH_SHORT).show()

                    AlertDialog.Builder(this)
                        .setTitle("Apply in Android Settings")
                        .setMessage("Copied '$chosenHost'.\n\nTo activate system-wide:\n1. Tap 'Open Settings' below.\n2. Tap 'Private DNS'.\n3. Select 'Private DNS provider hostname'.\n4. Paste '$chosenHost' and tap Save.")
                        .setPositiveButton("Open Settings") { _, _ ->
                            try {
                                startActivity(Intent(Settings.ACTION_WIRELESS_SETTINGS))
                            } catch (e: Exception) {
                                try {
                                    startActivity(Intent(Settings.ACTION_SETTINGS))
                                } catch (ex: Exception) {
                                    Toast.makeText(this, "Open phone Settings > Network > Private DNS", Toast.LENGTH_LONG).show()
                                }
                            }
                        }
                        .setNegativeButton("Done", null)
                        .show()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun setupVpnSettings() {
        updateVpnStatusText()
        binding.btnConfigureVpn.setOnClickListener {
            val modes = arrayOf(
                "Direct Connection (No VPN)",
                "Tor Onion Routing (Orbot 127.0.0.1:9050)",
                "Custom SOCKS5 / HTTP Proxy"
            )
            val currentMode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
            val checkedIndex = when (currentMode) {
                com.adshield.app.engine.VpnEngine.VpnMode.OFF -> 0
                com.adshield.app.engine.VpnEngine.VpnMode.TOR -> 1
                com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM -> 2
            }

            AlertDialog.Builder(this)
                .setTitle("Select VPN & Proxy Mode")
                .setSingleChoiceItems(modes, checkedIndex) { dialog, which ->
                    dialog.dismiss()
                    when (which) {
                        0 -> applyVpn(com.adshield.app.engine.VpnEngine.VpnMode.OFF)
                        1 -> applyVpn(com.adshield.app.engine.VpnEngine.VpnMode.TOR)
                        2 -> promptCustomProxy()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun updateVpnStatusText() {
        val mode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
        val text = when (mode) {
            com.adshield.app.engine.VpnEngine.VpnMode.OFF -> "Active: Direct Connection (Off)"
            com.adshield.app.engine.VpnEngine.VpnMode.TOR -> "Active: Tor / Orbot"
            com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM -> "Active: Custom (${com.adshield.app.engine.VpnEngine.getCustomProxy(this)})"
        }
        binding.textVpnStatus.text = text
    }

    private fun applyVpn(mode: com.adshield.app.engine.VpnEngine.VpnMode, customProxy: String? = null) {
        com.adshield.app.engine.VpnEngine.applyVpnMode(this, mode, customProxy) { _, msg ->
            runOnUiThread {
                updateVpnStatusText()
                Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun promptCustomProxy() {
        val input = android.widget.EditText(this).apply {
            hint = "e.g. socks5://127.0.0.1:1080"
            setText(com.adshield.app.engine.VpnEngine.getCustomProxy(this@SettingsActivity))
        }
        AlertDialog.Builder(this)
            .setTitle("Enter Proxy URL")
            .setView(input)
            .setPositiveButton("Apply") { _, _ ->
                val proxy = input.text.toString().trim()
                if (proxy.isNotEmpty()) {
                    applyVpn(com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM, proxy)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun setupSearchPrivacy() {
        val preferences = getSharedPreferences("fokk_browser_settings_v2", Context.MODE_PRIVATE)
        binding.switchRemoteSuggestions.isChecked = preferences.getBoolean(PREF_REMOTE_SUGGESTIONS, false)
        binding.switchRemoteSuggestions.setOnCheckedChangeListener { _, enabled ->
            preferences.edit().putBoolean(PREF_REMOTE_SUGGESTIONS, enabled).apply()
            val message = if (enabled) {
                "Typed searches may be sent to DuckDuckGo before you submit them"
            } else {
                "Only local history suggestions are shown"
            }
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
    }
    private fun setupPersonalizationButtons() {
        binding.btnWallpapersThemes.setOnClickListener {
            val intent = Intent(this, MediaHubActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(MediaHubActivity.EXTRA_OPEN_ACTION, "wallpapers")
            }
            startActivity(intent)
            finish()
        }

        binding.btnCustomizeSpeedDials.setOnClickListener {
            val intent = Intent(this, MediaHubActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(MediaHubActivity.EXTRA_OPEN_ACTION, "shortcuts")
            }
            startActivity(intent)
            finish()
        }
    }

    private fun setupUpdateChecker() {
        val vName = AppUpdateManager.getCurrentVersionName(this)
        binding.textSettingsVersionInfo.text = "Installed Version: $vName"
        binding.btnCheckForUpdates.setOnClickListener {
            AppUpdateManager.checkForUpdates(this, manualCheck = true)
        }
    }

    companion object {
        private const val PREF_REMOTE_SUGGESTIONS = "fokk_remote_search_suggestions"
    }
}
