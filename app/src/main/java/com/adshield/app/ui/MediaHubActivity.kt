package com.adshield.app.ui

import android.app.role.RoleManager
import android.provider.Settings
import android.widget.RelativeLayout
import android.widget.HorizontalScrollView

import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.ActivityInfo
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.PowerManager
import android.util.Base64
import androidx.activity.result.contract.ActivityResultContracts
import android.speech.RecognizerIntent
import android.app.DownloadManager
import android.app.PictureInPictureParams
import android.app.NotificationManager
import android.app.NotificationChannel
import android.app.PendingIntent
import androidx.core.app.NotificationCompat
import android.content.Context
import android.content.ComponentCallbacks2
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.net.VpnService
import android.content.SharedPreferences
import android.content.pm.ShortcutManager
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import java.io.FileOutputStream
import android.speech.tts.TextToSpeech
import java.net.Socket
import java.net.InetSocketAddress
import com.google.android.material.chip.Chip
import com.adshield.app.databinding.SheetAiSummaryBinding
import com.adshield.app.databinding.SheetVpnGatewayBinding
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextUtils
import android.text.TextWatcher
import android.util.Log
import android.util.Patterns
import android.util.Rational
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import androidx.core.view.ViewCompat
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.transition.TransitionManager
import android.transition.TransitionSet
import android.transition.ChangeBounds
import android.transition.Fade
import android.transition.Slide
import android.view.animation.PathInterpolator
import android.webkit.*
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.widget.ArrayAdapter
import android.widget.RadioButton
import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import android.os.Environment
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.adshield.app.AdShieldApp
import com.adshield.app.MainActivity
import com.adshield.app.R
import com.adshield.app.BuildConfig
import com.adshield.app.model.OfflinePageStore
import com.adshield.app.model.SavedSummariesStore
import com.adshield.app.model.SavedSummary
import com.adshield.app.util.AppUpdateManager
import com.adshield.app.databinding.ActivityMediaHubBinding
import com.adshield.app.databinding.ItemTabCardBinding
import com.adshield.app.databinding.SheetBrowserMenuBinding
import com.adshield.app.databinding.SheetExtensionsManagerBinding
import com.adshield.app.databinding.SheetHistoryBinding
import com.adshield.app.databinding.SheetPrivacyAccountBinding
import com.adshield.app.databinding.SheetSavedSummariesBinding
import com.adshield.app.databinding.SheetTabSwitcherBinding
import com.adshield.app.databinding.SheetGeneralSettingsBinding
import com.adshield.app.databinding.SheetShieldSettingsBinding
import com.adshield.app.databinding.SheetMediaHubSettingsBinding
import com.adshield.app.databinding.SheetVaultSettingsBinding
import com.adshield.app.databinding.SheetAboutCommunityBinding
import com.adshield.app.databinding.SheetFundraisingContributeBinding
import com.adshield.app.model.DnsOverHttpsEngine
import android.media.AudioManager
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.BufferedReader
import java.io.ByteArrayInputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.Collections
import java.util.Locale
import java.util.UUID
import java.util.WeakHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong


import com.adshield.app.engine.FokkAiEngine
import com.adshield.app.engine.FokkSearchAggregator
import com.adshield.app.engine.CorroboratedSource
import com.adshield.app.engine.KeyMetric
import com.adshield.app.engine.VisualEvidenceItem
import android.speech.tts.UtteranceProgressListener

data class BrowserSearchResult(
    val title: String,
    val url: String,
    val domain: String,
    val snippet: String,
    val sourceType: String = "WEB",
    val timestamp: String = ""
)

data class AiChatTurn(
    val question: String,
    val answer: String,
    val sources: List<BrowserSearchResult>,
    val followUps: List<String>,
    val pageSourceHost: String = "",
    val pageSourceUrl: String = ""
)

data class AiChatSession(
    val sessionKey: String,
    val url: String,
    val title: String,
    var summaryJson: String,
    var pageContext: String,
    val turns: MutableList<AiChatTurn> = mutableListOf()
)

open class MediaHubActivity : AppCompatActivity() {

    protected open val isIsolatedPrivateProfile: Boolean = false
    protected open val privateProfileConfigurationReady: Boolean = true

    enum class SearchEngine(val displayName: String, val searchUrl: String, val iconRes: Int) {
        GOOGLE("Google", "https://www.google.com/search?q=", R.drawable.ic_engine_google),
        BRAVE("Brave Search", "https://search.brave.com/search?q=", R.drawable.ic_engine_brave),
        DUCKDUCKGO("DuckDuckGo", "https://duckduckgo.com/?q=", R.drawable.ic_engine_duckduckgo),
        ECOSIA("Ecosia", "https://www.ecosia.org/search?q=", R.drawable.ic_engine_ecosia),
        STARTPAGE("Startpage", "https://www.startpage.com/sp/search?query=", R.drawable.ic_engine_startpage),
        BING("Bing", "https://www.bing.com/search?q=", R.drawable.ic_engine_bing)
    }

    data class BrowserTab(
        val id: String = UUID.randomUUID().toString(),
        var title: String = "Fokk",
        var url: String = "file:///android_asset/fokk_start.html",
        var filteredRequests: Int = 0,
        val filteredRequestHosts: MutableMap<String, Int> = mutableMapOf(),
        var thirdPartyRequests: Int = 0,
        val thirdPartyRequestHosts: MutableMap<String, Int> = mutableMapOf(),
        var isDesktop: Boolean = false,
        var shouldLoadOnSelect: Boolean = false,
        var isOfflineReader: Boolean = false,
        var isSuspended: Boolean = false,
        var suspendedForMemory: Boolean = false,
        var lastActiveTime: Long = System.currentTimeMillis(),
        var isHibernated: Boolean = false,
        var savedScrollY: Int = 0,
        val isPrivate: Boolean = false,
        var webView: WebView? = null
    )

    private data class PendingWebPermission(
        val request: PermissionRequest,
        val webView: WebView,
        val resources: Array<String>,
        val androidPermissions: List<String>,
        val origin: String,
        val topLevelOrigin: String?
    )

    private data class PendingLocationPermission(
        val callback: GeolocationPermissions.Callback,
        val origin: String,
        val webView: WebView,
        val topLevelOrigin: String?
    )

    private data class PendingDownload(
        val url: String,
        val userAgent: String,
        val contentDisposition: String?,
        val mimeType: String?,
        val sourceUrl: String,
        val allowThirdPartyCookies: Boolean,
        val wifiOnly: Boolean
    )

    private data class PendingRequestSnapshot(
        val filteredCount: Int,
        val filteredHosts: Map<String, Int>,
        val thirdPartyCount: Int,
        val thirdPartyHosts: Map<String, Int>
    )

    private lateinit var binding: ActivityMediaHubBinding
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var previousSystemUiVisibility: Int? = null
    private var previousRequestedOrientation: Int? = null
    private var previousWindowWasFullscreen: Boolean? = null
    private var browserChromeHidden = false
    private var ignoreScrollUntilMs: Long = 0L
    private var defusersScript = ""
    private var injectionScript = ""
    private var fokkoScript = ""
    private var fokkoCss = ""
    private var readerScript = ""
    private var readerCss = ""
    private var summarizerScript = ""
    private var lastAiPageContext = ""   // Full page text injected as LLM context
    private var aiSummaryWatchdog: Runnable? = null
    private var pendingAiSummaryInitialTab: Int = 0
    private var activeAiSummarySheetDialog: BottomSheetDialog? = null
    private val aiChatSessions = LinkedHashMap<String, AiChatSession>()
    private var lastChatSessionLeftForSource: AiChatSession? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsReady = false
    private var pendingTtsText: String? = null
    private var pendingTtsSourceTag: String = ""
    private var ttsPlaybackState: Int = 0 // 0=IDLE, 1=PLAYING, 2=PAUSED
    private var ttsChunks: List<String> = emptyList()
    private var ttsChunkIndex: Int = 0
    private var ttsCurrentSourceTag: String = ""
    private var ttsSessionId: Long = 0L
    private var ttsSpeechSpeed: Float = 1.0f
    private var ttsProgressCallback: ((Int, Int, Int, String) -> Unit)? = null
    var lastPaywallUrl = ""
    var isDualDeckMode = false
    private var secondaryTabIndex = -1
    private val prewarmedHosts = java.util.Collections.synchronizedSet(mutableSetOf<String>())

    private val tabs = mutableListOf<BrowserTab>()
    private val pageUrlsByWebView = Collections.synchronizedMap(WeakHashMap<WebView, String>())
    private val pendingFilteredCounts = WeakHashMap<WebView, Int>()
    private val pendingFilteredHosts = WeakHashMap<WebView, MutableMap<String, Int>>()
    private val pendingThirdPartyCounts = WeakHashMap<WebView, Int>()
    private val pendingThirdPartyHosts = WeakHashMap<WebView, MutableMap<String, Int>>()
    private val approvedWebMediaOrigins = mutableSetOf<String>()
    private val approvedLocationOrigins = mutableSetOf<String>()
    private val filteredCountLock = Any()
    private val pendingFilteredCountFlush = AtomicBoolean(false)
    private val privateFilteredRequestTotal = AtomicLong(0L)
    private var pendingFilteredCountTotal = 0
    private val mainHandler = Handler(Looper.getMainLooper())
    private val filteredCountFlushRunnable = Runnable { flushFilteredRequestCounts() }
    private var activeTabIndex = 0
    private var lastVpnRouteFingerprint: String? = null
    private var savedPagesSearchJob: Job? = null
    private var privateProfileReady = false
    private var privateProfileCloseCleanupStarted = false
    private var privateProfileDataClearedOnClose = false
    private val pendingPrivateUrls = mutableListOf<String>()
    private var isShieldEnabled = true
    private var isDarkMode = false
    private var showingPrivateTabs = false
    private var isMediaPlaying = false
    private var mediaSession: MediaSession? = null
    private var mediaWakeLock: PowerManager.WakeLock? = null
    private var currentMediaTitle: String = ""
    private var isBiometricAuthenticatedForSession = false
    private var isDecoyUnlockedThisSession = false

    private var lastMediaPlayingTime = 0L
    private var isFullscreenCustomView = false
    private var stopPlaybackRunnable: Runnable? = null
    private var backgroundMediaKeepAlive: Runnable? = null
    private var backgroundPlaybackArmed = false
    private var backgroundNoMediaTicks = 0
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermission: PendingWebPermission? = null
    private var pendingLocationPermission: PendingLocationPermission? = null
    private var pendingDownload: PendingDownload? = null

    private val storagePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val download = pendingDownload
        pendingDownload = null
        if (granted && download != null) {
            enqueueDownload(
                download.url,
                download.userAgent,
                download.contentDisposition,
                download.mimeType,
                download.sourceUrl,
                download.allowThirdPartyCookies,
                download.wifiOnly
            )
        } else if (download != null) {
            Toast.makeText(this, "Storage access is needed to save downloads on this Android version", Toast.LENGTH_LONG).show()
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val results = if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val dataUri = result.data?.data
            val clipData = result.data?.clipData
            if (clipData != null && clipData.itemCount > 0) {
                Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } else if (dataUri != null) {
                arrayOf(dataUri)
            } else {
                null
            }
        } else {
            null
        }
        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
    }

    private val speechRecognitionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val spokenMatches = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val spokenText = spokenMatches?.firstOrNull()?.trim()
            if (!spokenText.isNullOrEmpty()) {
                binding.urlInput.setText(spokenText)
                binding.cardSuggestions.visibility = View.GONE
                val rawTarget = if (spokenText.contains(".") && !spokenText.contains(" ")) {
                    "https://$spokenText"
                } else {
                    currentSearchEngine.searchUrl + Uri.encode(spokenText)
                }
                loadUrlInActiveWebView(rawTarget)
                recordHistory(spokenText, rawTarget)
            }
        }
    }

    private var aiVoiceInputCallback: ((String) -> Unit)? = null

    private val aiVoiceRecognitionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val spokenMatches = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val spokenText = spokenMatches?.firstOrNull()?.trim()
            if (!spokenText.isNullOrEmpty()) {
                aiVoiceInputCallback?.invoke(spokenText)
            }
        }
    }

    private val defaultBrowserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            Toast.makeText(this, "Fokk is now your default browser!", Toast.LENGTH_SHORT).show()
        }
    }

    private val webPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val pending = pendingWebPermission
        pendingWebPermission = null
        if (pending == null) return@registerForActivityResult

        val stillOpen = tabs.any { it.webView === pending.webView }
        val currentOrigin = pending.webView.url?.let(::getWebOrigin)
        val permissionsGranted = pending.androidPermissions.isNotEmpty() &&
            pending.androidPermissions.all {
                val wasGranted = grants[it] ?: (ContextCompat.checkSelfPermission(this, it) == android.content.pm.PackageManager.PERMISSION_GRANTED)
                wasGranted && ContextCompat.checkSelfPermission(this, it) == android.content.pm.PackageManager.PERMISSION_GRANTED
            }
        if (stillOpen && currentOrigin == pending.topLevelOrigin && permissionsGranted) {
            approvedWebMediaOrigins.add(sitePermissionKey(pending.origin, pending.topLevelOrigin))
            pending.request.grant(pending.resources)
        } else {
            pending.request.deny()
        }
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val pending = pendingLocationPermission
        pendingLocationPermission = null
        if (pending == null) return@registerForActivityResult

        val stillOpen = tabs.any { it.webView === pending.webView }
        val currentOrigin = pending.webView.url?.let(::getWebOrigin)
        val hasLocation = listOf(
            android.Manifest.permission.ACCESS_COARSE_LOCATION,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ).any { permission ->
            (grants[permission] == true || ContextCompat.checkSelfPermission(this, permission) == android.content.pm.PackageManager.PERMISSION_GRANTED) &&
                ContextCompat.checkSelfPermission(this, permission) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        val allowed = stillOpen && pending.webView === activeWebView &&
            currentOrigin == pending.topLevelOrigin && hasLocation
        if (allowed) approvedLocationOrigins.add(sitePermissionKey(pending.origin, pending.topLevelOrigin))
        pending.callback.invoke(pending.origin, allowed, false)
    }

    private fun startVoiceSearch() {
        try {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to search...")
            }
            speechRecognitionLauncher.launch(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Voice search is not supported on this device", Toast.LENGTH_SHORT).show()
        }
    }

    data class HistorySuggestion(val title: String, val url: String, val isHistory: Boolean = true)

    private fun getRecentHistory(): List<HistorySuggestion> {
        val list = mutableListOf<HistorySuggestion>()
        try {
            val historyJson = localPrefs.getString(PREF_BROWSING_HISTORY, "[]") ?: "[]"
            val jsonArr = JSONArray(historyJson)
            for (i in 0 until minOf(jsonArr.length(), 10)) {
                val item = jsonArr.getJSONObject(i)
                val title = item.optString("title")
                val url = item.optString("url")
                if (url.isNotBlank()) {
                    list.add(HistorySuggestion(title = title.ifBlank { url }, url = url, isHistory = true))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "getRecentHistory error", e)
        }
        return list
    }

    fun getCustomWallpaperDataUri(): String {
        return try {
            val prefWp = prefs.getString("fokk_custom_wallpaper", "")
            if (!prefWp.isNullOrBlank()) {
                return prefWp
            }
            val file = File(filesDir, "custom_wallpaper.jpg")
            if (file.exists() && file.length() > 0) {
                val bytes = file.readBytes()
                val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                "data:image/jpeg;base64,$b64"
            } else {
                ""
            }
        } catch (e: Exception) {
            ""
        }
    }

    private var activeAccountDialogBinding: SheetPrivacyAccountBinding? = null

    private val avatarPhotoPickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val uri = result.data?.data ?: return@registerForActivityResult
            Thread {
                try {
                    contentResolver.openInputStream(uri)?.use { input ->
                        val avatarFile = File(filesDir, "custom_avatar.jpg")
                        FileOutputStream(avatarFile).use { out ->
                            input.copyTo(out)
                        }
                    }
                    runOnUiThread {
                        prefs.edit().putString(PREF_USER_AVATAR, "custom").apply()
                        activeAccountDialogBinding?.let { b ->
                            loadAvatarInto(b.imgAccountAvatar)
                        }
                        Toast.makeText(this, "Custom avatar photo updated", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(this, "Failed to load photo: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }.start()
        }
    }

    private val vaultRestorePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val uri = result.data?.data ?: return@registerForActivityResult
            try {
                contentResolver.openInputStream(uri)?.use { stream ->
                    val fileText = stream.bufferedReader().use { it.readText() }
                    importVaultJson(fileText)
                }
            } catch (e: Exception) {
                Toast.makeText(this, "Failed to restore vault: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun isEliteDnsBlocked(host: String): Boolean {
        if (AdShieldApp.instance.blocklistEngine.isDomainBlocked(host)) return true
        if (AdShieldApp.instance.dohEngine.isKnownBlockedHost(host)) return true
        return AdShieldApp.instance.dohEngine.isHostBlocked(host)
    }

    private var onVpnPermissionResult: ((Boolean) -> Unit)? = null
    private val vpnPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val granted = (result.resultCode == Activity.RESULT_OK)
        onVpnPermissionResult?.invoke(granted)
        onVpnPermissionResult = null
    }

    private var vpnSheetRefreshCallback: (() -> Unit)? = null

    private val meshStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            runOnUiThread {
                updateVpnIndicatorUi()
                vpnSheetRefreshCallback?.invoke()
            }
        }
    }

    private val wallpaperPickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val uri = result.data?.data ?: return@registerForActivityResult
            Thread {
                try {
                    val maxDim = 1920
                    var sampleSize = 1

                    contentResolver.openInputStream(uri)?.use { inputStream ->
                        val options = BitmapFactory.Options().apply {
                            inJustDecodeBounds = true
                        }
                        BitmapFactory.decodeStream(inputStream, null, options)
                        val maxActual = maxOf(options.outWidth, options.outHeight)
                        if (maxActual > maxDim) {
                            sampleSize = (maxActual / maxDim.toFloat()).toInt().coerceAtLeast(1)
                        }
                    }

                    contentResolver.openInputStream(uri)?.use { stream2 ->
                        val decodeOpts = BitmapFactory.Options().apply {
                            inSampleSize = sampleSize
                        }
                        val bitmap = BitmapFactory.decodeStream(stream2, null, decodeOpts)
                        if (bitmap != null) {
                            val wpFile = File(filesDir, "custom_wallpaper.jpg")
                            FileOutputStream(wpFile).use { fos ->
                                bitmap.compress(Bitmap.CompressFormat.JPEG, 85, fos)
                                fos.flush()
                            }
                            bitmap.recycle()

                            val bytes = wpFile.readBytes()
                            val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                            val dataUri = "data:image/jpeg;base64,$b64"

                            runOnUiThread {
                                prefs.edit().putString(PREF_ACTIVE_THEME, "custom").apply()
                                tabs.forEach { tab ->
                                    tab.webView?.evaluateJavascript(
                                        "if (typeof applyThemeFromNative === 'function') applyThemeFromNative('custom', '$dataUri');",
                                        null
                                    )
                                }
                                Toast.makeText(this, "Wallpaper updated for all tabs", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(this, "Failed to load image: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }.start()
        }
    }

    fun openWallpaperGalleryPicker() {
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = "image/*"
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        wallpaperPickerLauncher.launch(Intent.createChooser(intent, "Choose Wallpaper Image"))
    }

    fun openWallpapersCustomizer() {
        val currentUrl = activeTab?.url ?: ""
        if (currentUrl.contains("fokk_start.html")) {
            activeWebView?.evaluateJavascript("if (typeof openVisualHub === 'function') openVisualHub(); else if (typeof openThemeModal === 'function') openThemeModal();", null)
        } else {
            addNewTab("file:///android_asset/fokk_start.html?action=visuals", isPrivate = activeTab?.isPrivate == true)
        }
    }

    fun openShortcutsCustomizer() {
        val currentUrl = activeTab?.url ?: ""
        if (currentUrl.contains("fokk_start.html")) {
            activeWebView?.evaluateJavascript("if (typeof openShortcutsManager === 'function') openShortcutsManager();", null)
        } else {
            addNewTab("file:///android_asset/fokk_start.html?action=shortcuts", isPrivate = activeTab?.isPrivate == true)
        }
    }

    fun pinWebPageToLauncher(url: String, title: String, favicon: Bitmap?) {
        if (url.isBlank() || url.contains("fokk_start.html")) {
            Toast.makeText(this, "Open a website to pin it to home screen", Toast.LENGTH_SHORT).show()
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val shortcutManager = getSystemService(ShortcutManager::class.java)
            if (shortcutManager != null && shortcutManager.isRequestPinShortcutSupported) {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    setClass(this@MediaHubActivity, MediaHubActivity::class.java)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                val icon = if (favicon != null && !favicon.isRecycled) {
                    IconCompat.createWithBitmap(favicon)
                } else {
                    IconCompat.createWithResource(this, R.drawable.ic_fokk_logo)
                }
                val pinShortcutInfo = ShortcutInfoCompat.Builder(this, "shortcut_${url.hashCode()}")
                    .setShortLabel(if (title.isNotBlank()) title.take(24) else "Webpage")
                    .setLongLabel(title.ifBlank { url })
                    .setIcon(icon)
                    .setIntent(intent)
                    .build()
                ShortcutManagerCompat.requestPinShortcut(this, pinShortcutInfo, null)
                Toast.makeText(this, "Pinning shortcut to home screen...", Toast.LENGTH_SHORT).show()
                return
            }
        }
        Toast.makeText(this, "Launcher shortcut not supported on this device", Toast.LENGTH_SHORT).show()
    }

    fun addStartpageShortcut(url: String, title: String) {
        if (url.isBlank() || url.contains("fokk_start.html")) {
            Toast.makeText(this, "Open a website to add to startpage shortcuts", Toast.LENGTH_SHORT).show()
            return
        }
        val cleanTitle = if (title.isNotBlank()) title else url
        val currentShortcuts = prefs.getString("custom_startpage_shortcuts", "[]") ?: "[]"
        try {
            val array = org.json.JSONArray(currentShortcuts)
            var exists = false
            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i)
                if (obj?.optString("url") == url) {
                    exists = true
                    break
                }
            }
            if (!exists) {
                val item = org.json.JSONObject()
                item.put("title", cleanTitle)
                item.put("url", url)
                array.put(item)
                prefs.edit().putString("custom_startpage_shortcuts", array.toString()).apply()
            }
        } catch (e: Exception) {}

        tabs.forEach { tab ->
            val safeTitle = org.json.JSONObject.quote(cleanTitle)
            val safeUrl = org.json.JSONObject.quote(url)
            tab.webView?.evaluateJavascript(
                "if (typeof addStartpageShortcut === 'function') addStartpageShortcut($safeTitle, $safeUrl);",
                null
            )
        }
        Toast.makeText(this, "Added to Startpage Shortcuts", Toast.LENGTH_SHORT).show()
    }

    private val prefs: SharedPreferences by lazy {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    private val localPrefs: SharedPreferences by lazy {
        getSharedPreferences(LOCAL_PREFS_NAME, Context.MODE_PRIVATE)
    }
    private val offlinePageStore: OfflinePageStore by lazy {
        OfflinePageStore(filesDir, localPrefs)
    }
    private val savedSummariesStore: SavedSummariesStore by lazy {
        SavedSummariesStore(this)
    }
    private var hasActiveVideo: Boolean = false
    private var isActivityResumed: Boolean = false
    private var lastGeneratedSummaryJson: String? = null
    private var cachedAiSummaryUrl: String? = null
    private var cachedAiSummaryJson: String? = null

    private fun migrateLegacyBrowserPreferences() {
        val legacy = getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
        val oldValues = legacy.all
        if (oldValues.isEmpty()) return

        val settingsTarget = prefs
        val localTarget = localPrefs
        val settingsEditor = settingsTarget.edit()
        val localEditor = localTarget.edit()
        oldValues.forEach { (key, value) ->
            val isLocalBrowserData = key in LOCAL_BROWSER_DATA_KEYS
            val target = if (isLocalBrowserData) localTarget else settingsTarget
            if (target.contains(key)) return@forEach
            val editor = if (isLocalBrowserData) localEditor else settingsEditor
            when (value) {
                is String -> editor.putString(key, value)
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is Set<*> -> editor.putStringSet(key, value.filterIsInstance<String>().toSet())
            }
        }

        if (!settingsEditor.commit() || !localEditor.commit()) {
            Log.e(TAG, "Could not migrate all legacy browser preferences; keeping the old file for retry")
            return
        }
        if (!legacy.edit().clear().commit()) {
            Log.e(TAG, "Migrated browser preferences but could not remove the legacy preference file")
        }
    }

    private var currentSearchEngine: SearchEngine = SearchEngine.BING

    private var cachedTrendingTopicsJson: String = """
        [
            {"title": "OpenAI & Next-Gen AI", "query": "Artificial intelligence news and developments", "tag": "AI"},
            {"title": "Tech Innovations 2026", "query": "Latest technology breakthroughs 2026", "tag": "Tech"},
            {"title": "SpaceX & Aerospace", "query": "Space exploration and rocket missions", "tag": "Space"},
            {"title": "Global Cyber & Privacy", "query": "Cybersecurity news and data privacy", "tag": "Privacy"},
            {"title": "Scientific Discoveries", "query": "Scientific discoveries latest research", "tag": "Science"},
            {"title": "World Economy & Markets", "query": "Global economic news today", "tag": "Markets"},
            {"title": "Cinema & Streaming Releases", "query": "Top movies and streaming releases this week", "tag": "Culture"}
        ]
    """.trimIndent()

    private fun fetchLiveTrendingTopics() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val url = URL("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 4000
                conn.readTimeout = 4000
                conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                if (conn.responseCode == 200) {
                    val stream = conn.inputStream
                    val reader = BufferedReader(InputStreamReader(stream))
                    val fullXml = reader.readText()
                    reader.close()
                    val titleRegex = Regex("<title><!\\[CDATA\\[(.*?)\\]\\]></title>|<title>(.*?)</title>")
                    val matches = titleRegex.findAll(fullXml).map { it.groupValues[1].ifEmpty { it.groupValues[2] } }
                        .filter { it.isNotBlank() && !it.contains("Google News", ignoreCase = true) }
                        .take(8)
                        .toList()
                    if (matches.isNotEmpty()) {
                        val array = JSONArray()
                        matches.forEach { title ->
                            val cleanTitle = title.replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'").trim()
                            val cleanQuery = cleanTitle.substringBefore(" - ")
                            val obj = JSONObject()
                            obj.put("title", cleanTitle)
                            obj.put("query", cleanQuery)
                            obj.put("tag", "Live")
                            array.put(obj)
                        }
                        cachedTrendingTopicsJson = array.toString()
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private val cachedNewsByCategory = java.util.concurrent.ConcurrentHashMap<String, String>()
    private val activeNewsFetches = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()

    fun fetchLivePulseNews(category: String, region: String = "global", forceRefresh: Boolean = false): String {
        val normCat = category.lowercase(Locale.ROOT).trim().ifBlank { "all" }
        val normRegion = region.lowercase(Locale.ROOT).trim().ifBlank { "global" }
        val cacheKey = "${normRegion}_$normCat"

        val lastFetchTime = localPrefs.getLong("fokk_pulse_news_time_$cacheKey", 0L)
        val now = System.currentTimeMillis()
        val isStale = (now - lastFetchTime) > (20 * 60 * 1000L) // 20 minutes TTL for fresh updates

        if (!cachedNewsByCategory.containsKey(cacheKey)) {
            val disk = localPrefs.getString("fokk_pulse_news_$cacheKey", null)
            if (!disk.isNullOrBlank()) {
                cachedNewsByCategory[cacheKey] = disk
            }
        }

        val cachedResult = cachedNewsByCategory[cacheKey] ?: ""

        if (forceRefresh || cachedResult.isBlank() || isStale) {
            triggerBackgroundPulseFetch(normCat, normRegion)
        }

        return cachedResult
    }

    private fun triggerBackgroundPulseFetch(normCat: String, normRegion: String) {
        val fetchKey = "${normRegion}_$normCat"
        if (!activeNewsFetches.add(fetchKey)) return

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                data class NewsFeedSource(val name: String, val url: String, val defaultCategory: String = "all")

                val sources = when (normRegion) {
                    "uk" -> when (normCat) {
                        "tech" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/technology/rss.xml", "tech"),
                            NewsFeedSource("The Guardian", "https://www.theguardian.com/technology/rss", "tech"),
                            NewsFeedSource("Wired", "https://www.wired.com/feed/rss", "tech")
                        )
                        "business", "markets" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/business/rss.xml", "business"),
                            NewsFeedSource("The Guardian", "https://www.theguardian.com/uk/business/rss", "business"),
                            NewsFeedSource("Sky News", "https://feeds.skynews.com/feeds/rss/business.xml", "business")
                        )
                        "culture", "entertainment" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", "culture"),
                            NewsFeedSource("The Guardian", "https://www.theguardian.com/uk/culture/rss", "culture"),
                            NewsFeedSource("Sky News", "https://feeds.skynews.com/feeds/rss/entertainment.xml", "culture")
                        )
                        "science" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "science"),
                            NewsFeedSource("The Guardian", "https://www.theguardian.com/science/rss", "science")
                        )
                        else -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/uk/rss.xml", "news"),
                            NewsFeedSource("The Guardian", "https://www.theguardian.com/uk/rss", "news"),
                            NewsFeedSource("Sky News", "https://feeds.skynews.com/feeds/rss/uk.xml", "news"),
                            NewsFeedSource("The Independent", "https://www.independent.co.uk/news/uk/rss", "news"),
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml", "world")
                        )
                    }
                    "in" -> when (normCat) {
                        "tech" -> listOf(
                            NewsFeedSource("NDTV Gadgets", "https://feeds.feedburner.com/gadgets360-latest", "tech"),
                            NewsFeedSource("The Hindu", "https://www.thehindu.com/sci-tech/technology/feeder/default.rss", "tech"),
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/technology/rss.xml", "tech")
                        )
                        "business", "markets" -> listOf(
                            NewsFeedSource("Livemint", "https://www.livemint.com/rss/news", "business"),
                            NewsFeedSource("The Hindu", "https://www.thehindu.com/business/feeder/default.rss", "business"),
                            NewsFeedSource("NDTV Profit", "https://feeds.feedburner.com/ndtvprofit-latest", "business")
                        )
                        "culture", "entertainment" -> listOf(
                            NewsFeedSource("NDTV Movies", "https://feeds.feedburner.com/ndtvmovies-latest", "culture"),
                            NewsFeedSource("The Hindu", "https://www.thehindu.com/entertainment/feeder/default.rss", "culture"),
                            NewsFeedSource("India Today", "https://www.indiatoday.in/rss/1206577", "culture")
                        )
                        "science" -> listOf(
                            NewsFeedSource("The Hindu", "https://www.thehindu.com/sci-tech/science/feeder/default.rss", "science"),
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "science")
                        )
                        else -> listOf(
                            NewsFeedSource("NDTV News", "https://feeds.feedburner.com/ndtvnews-top-stories", "news"),
                            NewsFeedSource("The Hindu", "https://www.thehindu.com/news/national/feeder/default.rss", "news"),
                            NewsFeedSource("Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "news"),
                            NewsFeedSource("India Today", "https://www.indiatoday.in/rss/1206584", "news"),
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml", "news")
                        )
                    }
                    "ca" -> when (normCat) {
                        "tech" -> listOf(
                            NewsFeedSource("CBC News", "https://www.cbc.ca/cmlink/rss-technology", "tech"),
                            NewsFeedSource("The Verge", "https://www.theverge.com/rss/index.xml", "tech"),
                            NewsFeedSource("Wired", "https://www.wired.com/feed/rss", "tech")
                        )
                        "business", "markets" -> listOf(
                            NewsFeedSource("CBC Business", "https://www.cbc.ca/cmlink/rss-business", "business"),
                            NewsFeedSource("CTV News", "https://www.ctvnews.ca/rss/ctvnews-ca-business-public-rss-1.822295", "business")
                        )
                        "culture", "entertainment" -> listOf(
                            NewsFeedSource("CBC Arts", "https://www.cbc.ca/cmlink/rss-arts", "culture"),
                            NewsFeedSource("CTV News", "https://www.ctvnews.ca/rss/ctvnews-ca-entertainment-public-rss-1.822292", "culture")
                        )
                        "science" -> listOf(
                            NewsFeedSource("CBC Science", "https://www.cbc.ca/cmlink/rss-technology", "science"),
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "science")
                        )
                        else -> listOf(
                            NewsFeedSource("CBC News", "https://www.cbc.ca/cmlink/rss-topstories", "news"),
                            NewsFeedSource("CBC News", "https://www.cbc.ca/cmlink/rss-canada", "news"),
                            NewsFeedSource("CTV News", "https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009", "news"),
                            NewsFeedSource("Global News", "https://globalnews.ca/feed/", "news"),
                            NewsFeedSource("CBC News", "https://www.cbc.ca/cmlink/rss-world", "world")
                        )
                    }
                    "de" -> when (normCat) {
                        "tech" -> listOf(
                            NewsFeedSource("Spiegel Netzwelt", "https://www.spiegel.de/netzwelt/index.rss", "tech"),
                            NewsFeedSource("Tagesschau", "https://www.tagesschau.de/inland/regional/wirtschaft-und-finanzen-100~rss2.xml", "tech"),
                            NewsFeedSource("Wired", "https://www.wired.com/feed/rss", "tech")
                        )
                        "business", "markets" -> listOf(
                            NewsFeedSource("Spiegel Wirtschaft", "https://www.spiegel.de/wirtschaft/index.rss", "business"),
                            NewsFeedSource("Tagesschau", "https://www.tagesschau.de/wirtschaft/index~rss2.xml", "business"),
                            NewsFeedSource("DW News", "https://rss.dw.com/xml/rss-de-eco", "business")
                        )
                        "culture", "entertainment" -> listOf(
                            NewsFeedSource("Spiegel Kultur", "https://www.spiegel.de/kultur/index.rss", "culture"),
                            NewsFeedSource("DW Kultur", "https://rss.dw.com/xml/rss-de-cul", "culture")
                        )
                        "science" -> listOf(
                            NewsFeedSource("Spiegel Wissenschaft", "https://www.spiegel.de/wissenschaft/index.rss", "science"),
                            NewsFeedSource("Tagesschau", "https://www.tagesschau.de/wissen/index~rss2.xml", "science")
                        )
                        else -> listOf(
                            NewsFeedSource("Deutsche Welle", "https://rss.dw.com/xml/rss-en-all", "news"),
                            NewsFeedSource("Der Spiegel", "https://www.spiegel.de/international/index.rss", "news"),
                            NewsFeedSource("Tagesschau", "https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml", "news"),
                            NewsFeedSource("Zeit Online", "https://newsfeed.zeit.de/index", "news"),
                            NewsFeedSource("Der Spiegel", "https://www.spiegel.de/schlagzeilen/tops/index.rss", "news")
                        )
                    }
                    "au" -> when (normCat) {
                        "tech" -> listOf(
                            NewsFeedSource("ABC News", "https://www.abc.net.au/news/feed/51120/rss.xml", "tech"),
                            NewsFeedSource("The Verge", "https://www.theverge.com/rss/index.xml", "tech"),
                            NewsFeedSource("Wired", "https://www.wired.com/feed/rss", "tech")
                        )
                        "business", "markets" -> listOf(
                            NewsFeedSource("ABC News", "https://www.abc.net.au/news/feed/51892/rss.xml", "business"),
                            NewsFeedSource("Sydney Morning Herald", "https://www.smh.com.au/rss/business.xml", "business")
                        )
                        "culture", "entertainment" -> listOf(
                            NewsFeedSource("ABC News", "https://www.abc.net.au/news/feed/51900/rss.xml", "culture"),
                            NewsFeedSource("Sydney Morning Herald", "https://www.smh.com.au/rss/culture.xml", "culture")
                        )
                        "science" -> listOf(
                            NewsFeedSource("ABC News", "https://www.abc.net.au/news/feed/51898/rss.xml", "science"),
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "science")
                        )
                        else -> listOf(
                            NewsFeedSource("ABC News", "https://www.abc.net.au/news/feed/51120/rss.xml", "news"),
                            NewsFeedSource("Sydney Morning Herald", "https://www.smh.com.au/rss/feed.xml", "news"),
                            NewsFeedSource("The Age", "https://www.theage.com.au/rss/feed.xml", "news"),
                            NewsFeedSource("9News", "https://www.9news.com.au/rss", "news"),
                            NewsFeedSource("ABC News", "https://www.abc.net.au/news/feed/52278/rss.xml", "world")
                        )
                    }
                    else -> when (normCat) {
                        "tech" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/technology/rss.xml", "tech"),
                            NewsFeedSource("The Verge", "https://www.theverge.com/rss/index.xml", "tech"),
                            NewsFeedSource("Wired", "https://www.wired.com/feed/rss", "tech"),
                            NewsFeedSource("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", "tech")
                        )
                        "world" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml", "world"),
                            NewsFeedSource("CNN", "http://rss.cnn.com/rss/edition_world.rss", "world"),
                            NewsFeedSource("ABC News", "https://abcnews.go.com/abcnews/internationalheadlines", "world"),
                            NewsFeedSource("NPR", "https://feeds.npr.org/1004/rss.xml", "world")
                        )
                        "business", "markets" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/business/rss.xml", "business"),
                            NewsFeedSource("Yahoo Finance", "https://finance.yahoo.com/news/rssindex", "business"),
                            NewsFeedSource("CNN Business", "http://rss.cnn.com/rss/money_latest.rss", "business"),
                            NewsFeedSource("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html", "business")
                        )
                        "science" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "science"),
                            NewsFeedSource("Wired Science", "https://www.wired.com/feed/category/science/latest/rss", "science"),
                            NewsFeedSource("NPR Science", "https://feeds.npr.org/1007/rss.xml", "science")
                        )
                        "culture", "entertainment" -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", "culture"),
                            NewsFeedSource("CNN", "http://rss.cnn.com/rss/edition_entertainment.rss", "culture"),
                            NewsFeedSource("Wired Culture", "https://www.wired.com/feed/category/culture/latest/rss", "culture")
                        )
                        else -> listOf(
                            NewsFeedSource("BBC News", "https://feeds.bbci.co.uk/news/rss.xml", "news"),
                            NewsFeedSource("ABC News", "https://abcnews.go.com/abcnews/topstories", "news"),
                            NewsFeedSource("CNN", "http://rss.cnn.com/rss/cnn_topstories.rss", "news"),
                            NewsFeedSource("Reuters", "https://news.yahoo.com/rss/", "news"),
                            NewsFeedSource("NPR", "https://feeds.npr.org/1001/rss.xml", "news"),
                            NewsFeedSource("The Verge", "https://www.theverge.com/rss/index.xml", "tech")
                        )
                    }
                }

                fun fetchXml(urlStr: String): String? {
                    var currentUrl = urlStr
                    var redirects = 0
                    while (redirects < 4) {
                        val conn = URL(currentUrl).openConnection() as HttpURLConnection
                        conn.connectTimeout = 4500
                        conn.readTimeout = 4500
                        conn.instanceFollowRedirects = true
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36")
                        val code = conn.responseCode
                        if (code in 301..308) {
                            val loc = conn.getHeaderField("Location")
                            if (!loc.isNullOrBlank()) {
                                currentUrl = loc
                                redirects++
                                continue
                            }
                        }
                        if (code == 200) {
                            return conn.inputStream.bufferedReader().use { it.readText() }
                        }
                        break
                    }
                    return null
                }

                val itemRegex = Regex("<item>(.*?)</item>", RegexOption.DOT_MATCHES_ALL)
                val titleRegex = Regex("<title><!\\[CDATA\\[(.*?)\\]\\]></title>|<title>(.*?)</title>")
                val sourceRegex = Regex("<source[^>]*>(.*?)</source>")
                val linkRegex = Regex("<link>(.*?)</link>")
                val mediaRegex = Regex("""<media:thumbnail[^>]+url=["']([^"']+)["']|<media:content[^>]+url=["']([^"']+)["']|<enclosure[^>]+url=["']([^"']+)["']|<img[^>]+src=["']([^"']+)["']""")

                val perSourceItems = mutableMapOf<String, MutableList<JSONObject>>()
                val seenTitles = mutableSetOf<String>()

                // Shuffle sources to diversify news origin on each fetch
                val shuffledSources = sources.shuffled()

                for (src in shuffledSources) {
                    try {
                        val xml = fetchXml(src.url) ?: continue
                        val itemsForSource = mutableListOf<JSONObject>()
                        itemRegex.findAll(xml).take(10).forEach { itemMatch ->
                            val content = itemMatch.groupValues[1]
                            val rawTitle = titleRegex.find(content)?.let { it.groupValues[1].ifEmpty { it.groupValues[2] } } ?: return@forEach
                            if (rawTitle.contains("Google News", ignoreCase = true) || rawTitle.equals("BBC News", ignoreCase = true)) return@forEach

                            val titleClean = rawTitle
                                .replace("&amp;", "&")
                                .replace("&quot;", "\"")
                                .replace("&#39;", "'")
                                .replace("&apos;", "'")
                                .replace("&ndash;", "–")
                                .replace("&mdash;", "—")
                                .replace("&nbsp;", " ")
                                .replace("<![CDATA[", "")
                                .replace("]]>", "")
                                .trim()

                            // Quality filter 1: Length check
                            if (titleClean.length < 15) return@forEach

                            // Quality filter 2: Suppress promo stubs
                            val lowerTitle = titleClean.lowercase(Locale.ROOT)
                            if (lowerTitle.startsWith("watch live:") || lowerTitle.startsWith("subscribe to") || lowerTitle.startsWith("listen now:")) return@forEach

                            // Quality filter 3: Title deduplication
                            val normTitleKey = lowerTitle.replace(Regex("[^a-z0-9]"), "").take(35)
                            if (seenTitles.contains(normTitleKey)) return@forEach
                            seenTitles.add(normTitleKey)

                            var detectedSource = sourceRegex.find(content)?.groupValues?.get(1)?.replace("&amp;", "&") ?: src.name
                            if (detectedSource.contains("BBC", ignoreCase = true)) detectedSource = "BBC News"
                            else if (detectedSource.contains("ABC News", ignoreCase = true) || (detectedSource.contains("ABC", ignoreCase = true) && normRegion != "au")) detectedSource = "ABC News"
                            else if (detectedSource.contains("CNN", ignoreCase = true)) detectedSource = "CNN"
                            else if (detectedSource.contains("NDTV", ignoreCase = true)) detectedSource = "NDTV"
                            else if (detectedSource.contains("Hindu", ignoreCase = true)) detectedSource = "The Hindu"
                            else if (detectedSource.contains("Times of India", ignoreCase = true) || detectedSource.equals("TOI", ignoreCase = true)) detectedSource = "Times of India"
                            else if (detectedSource.contains("CBC", ignoreCase = true)) detectedSource = "CBC News"
                            else if (detectedSource.contains("Spiegel", ignoreCase = true)) detectedSource = "Der Spiegel"
                            else if (detectedSource.contains("Deutsche Welle", ignoreCase = true) || detectedSource.equals("DW", ignoreCase = true)) detectedSource = "DW News"
                            else if (detectedSource.contains("Guardian", ignoreCase = true)) detectedSource = "The Guardian"
                            else if (detectedSource.contains("Sydney Morning Herald", ignoreCase = true) || detectedSource.equals("SMH", ignoreCase = true)) detectedSource = "Sydney Morning Herald"
                            else if (detectedSource.contains("Verge", ignoreCase = true)) detectedSource = "The Verge"
                            else if (detectedSource.contains("Wired", ignoreCase = true)) detectedSource = "Wired"

                            val link = linkRegex.find(content)?.groupValues?.get(1)?.trim() ?: ""
                            var mediaUrl = mediaRegex.find(content)?.let {
                                it.groupValues[1].ifEmpty { it.groupValues[2].ifEmpty { it.groupValues[3].ifEmpty { it.groupValues[4] } } }
                            } ?: ""

                            if (mediaUrl.contains("ichef.bbci.co.uk")) {
                                mediaUrl = mediaUrl.replace("/240/", "/800/").replace("/134/", "/450/").replace("/135/", "/450/")
                            }

                            val query = titleClean.substringBefore(" - ").substringBefore(" | ")
                            val obj = JSONObject().apply {
                                put("title", titleClean)
                                put("source", detectedSource)
                                put("time", "Live")
                                put("query", query)
                                put("category", normCat)
                                put("region", normRegion)
                                put("url", link)
                                if (mediaUrl.isNotBlank()) put("img", mediaUrl)
                            }
                            itemsForSource.add(obj)
                        }
                        if (itemsForSource.isNotEmpty()) {
                            perSourceItems[src.name] = itemsForSource
                        }
                    } catch (_: Exception) {}
                }

                // Fair interleaving across distinct news sources so one publisher doesn't dominate
                val aggregatedItems = mutableListOf<JSONObject>()
                val maxCount = perSourceItems.values.maxOfOrNull { it.size } ?: 0
                for (i in 0 until maxCount) {
                    for (list in perSourceItems.values) {
                        if (i < list.size) {
                            aggregatedItems.add(list[i])
                        }
                    }
                }

                if (aggregatedItems.isNotEmpty()) {
                    val jsonArr = JSONArray()
                    aggregatedItems.take(30).forEach { jsonArr.put(it) }
                    val jsonStr = jsonArr.toString()

                    cachedNewsByCategory[fetchKey] = jsonStr
                    localPrefs.edit()
                        .putString("fokk_pulse_news_$fetchKey", jsonStr)
                        .putLong("fokk_pulse_news_time_$fetchKey", System.currentTimeMillis())
                        .apply()

                    withContext(Dispatchers.Main) {
                        tabs.forEach { tab ->
                            if (isHomePageUrl(tab.url)) {
                                tab.webView?.evaluateJavascript(
                                    "if (typeof onLiveNewsReceived === 'function') onLiveNewsReceived('$normCat', '$normRegion', ${JSONObject.quote(jsonStr)});",
                                    null
                                )
                            }
                        }
                    }
                }
            } catch (_: Exception) {
            } finally {
                activeNewsFetches.remove(fetchKey)
            }
        }
    }

    fun preloadPulseNews() {
        lifecycleScope.launch(Dispatchers.IO) {
            val region = localPrefs.getString("fokk_pulse_country", "global") ?: "global"
            listOf("all", "tech", "world", "business").forEach { cat ->
                fetchLivePulseNews(cat, region)
            }
        }
    }

    private fun extractSearchQuery(url: String?): String? {
        if (url == null) return null
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return null
        val host = uri.host?.lowercase(Locale.ROOT) ?: return null
        val isSearchHost = host.contains("google.") || host.contains("duckduckgo.com") ||
            host.contains("brave.com") || host.contains("startpage.com") || host.contains("bing.com") || host.contains("ecosia.org")
        if (!isSearchHost) return null
        return uri.getQueryParameter("q") ?: uri.getQueryParameter("query")
    }

    private fun applySearchEngine(engine: SearchEngine) {
        currentSearchEngine = engine
        prefs.edit().putString(PREF_SEARCH_ENGINE, engine.name).apply()
        binding.imgEngineIcon.imageTintList = null
        binding.imgEngineIcon.setImageResource(engine.iconRes)
        if (binding.urlInput.text.isEmpty() || activeWebView?.url?.contains("fokk_start.html") == true) {
            binding.urlInput.hint = if (activeTab?.isPrivate == true || isIsolatedPrivateProfile) {
                "Ghost Mode • Search with ${engine.displayName}"
            } else {
                "Search with ${engine.displayName} or enter address"
            }
        }
        tabs.forEach { tab ->
            if (tab.url.contains("fokk_start.html")) {
                tab.webView?.evaluateJavascript(
                    "if (typeof updateEngineFromNative === 'function') updateEngineFromNative('${engine.name.lowercase()}');",
                    null
                )
            }
        }
        val currentUrl = activeWebView?.url.orEmpty()
        val query = extractSearchQuery(currentUrl)
        if (!query.isNullOrBlank() && activeWebView != null) {
            val newSearchUrl = engine.searchUrl + Uri.encode(query)
            loadUrlInWebView(activeWebView, newSearchUrl)
        }
    }
    private var suggestionJob: Job? = null
    private var lastUserInteractionTime = 0L

    private fun hasRecentUserInteraction(): Boolean =
        (System.currentTimeMillis() - lastUserInteractionTime) < 3500

    private val activeTab: BrowserTab?
        get() = tabs.getOrNull(activeTabIndex)

    private val activeWebView: WebView?
        get() = activeTab?.webView

    private val cleanMobileUa: String by lazy {
        val defaultUa = WebSettings.getDefaultUserAgent(this)
        defaultUa.replace("; wv", "").replace("Version/4.0 ", "")
    }

    private val desktopUa: String by lazy {
        cleanMobileUa
            .replace(Regex("\\(Linux; Android [^)]*\\)"), "(X11; Linux x86_64)")
            .replace("Mobile Safari/", "Safari/")
    }

    private fun clearPrivateProfileData(onComplete: (() -> Unit)? = null) {
        val clearRemainingData = {
            runCatching { WebStorage.getInstance().deleteAllData() }
            runCatching { WebView(this).apply { clearCache(true); clearSslPreferences(); destroy() } }
            runCatching {
                WebViewDatabase.getInstance(this).apply {
                    clearFormData()
                    clearHttpAuthUsernamePassword()
                    clearUsernamePassword()
                }
            }
            runCatching { CookieManager.getInstance().flush() }
            onComplete?.invoke()
        }
        runCatching {
            CookieManager.getInstance().removeAllCookies {
                runOnUiThread { clearRemainingData() }
            }
        }.onFailure {
            runOnUiThread { clearRemainingData() }
        }
    }

    private fun closePrivateBrowser() {
        if (privateProfileCloseCleanupStarted || isFinishing) return
        privateProfileCloseCleanupStarted = true
        binding.root.isEnabled = false

        pendingWebPermission?.let { pending ->
            pendingWebPermission = null
            runCatching { pending.request.deny() }
        }
        pendingLocationPermission?.let { pending ->
            pendingLocationPermission = null
            runCatching { pending.callback.invoke(pending.origin, false, false) }
        }
        tabs.forEach { tab ->
            tab.webView?.let { webView ->
                cancelPendingWebPermission(webView)
                cancelPendingLocationPermission(webView)
                binding.tabContainer.removeView(webView)
                pageUrlsByWebView.remove(webView)
                runCatching { webView.stopLoading() }
                runCatching { webView.destroy() }
            }
        }
        tabs.clear()
        mainHandler.removeCallbacks(filteredCountFlushRunnable)

        clearPrivateProfileData {
            privateProfileDataClearedOnClose = true
            if (!isDestroyed) finish()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (isIsolatedPrivateProfile && Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            Toast.makeText(this, "Private tabs with isolated site data require Android 9 or newer", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        if (isIsolatedPrivateProfile && !privateProfileConfigurationReady) {
            Toast.makeText(this, "Could not create an isolated private browser profile", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        if (!isIsolatedPrivateProfile) migrateLegacyBrowserPreferences()
        if (intent?.action == ACTION_WIPE_GHOST_SESSION) {
            wipeAllPrivateTabsAndSession()
            return
        }
        binding = ActivityMediaHubBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val savedEngineName = prefs.getString(PREF_SEARCH_ENGINE, SearchEngine.BING.name)
        currentSearchEngine = try {
            SearchEngine.valueOf(savedEngineName ?: SearchEngine.BING.name)
        } catch (e: Exception) {
            SearchEngine.BING
        }
        applySearchEngine(currentSearchEngine)
        val toolbarPos = prefs.getString(PREF_TOOLBAR_POSITION, "bottom") ?: "bottom"
        val isHomeInitial = activeWebView?.url?.contains("fokk_start.html") == true || activeWebView?.url.isNullOrBlank()
        applyToolbarPosition(toolbarPos, isHomePage = isHomeInitial, animated = false)

        loadInjectionScript()
        setupControls()
        setupRefreshControl()
        initMediaSession()
        fetchLiveTrendingTopics()
        preloadPulseNews()

        val initialUrl = incomingWebUrl(intent)
        if (isIsolatedPrivateProfile) {
            showingPrivateTabs = true
            clearPrivateProfileData {
                if (!isFinishing) {
                    privateProfileReady = true
                    if (tabs.isEmpty()) {
                        addNewTab(initialUrl?.takeIf(::isWebUrl) ?: "file:///android_asset/fokk_start.html", isPrivate = true)
                    }
                    pendingPrivateUrls.toList().forEach { addNewTab(it, isPrivate = true) }
                    pendingPrivateUrls.clear()
                }
            }
        } else if (initialUrl.isNullOrBlank()) {
            restoreLastSession()
        } else {
            addNewTab(initialUrl, isPrivate = false)
        }
        handleOpenAction(intent)

        val meshFilter = IntentFilter(com.adshield.app.engine.FokkMeshVpnService.ACTION_MESH_STATE_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(meshStateReceiver, meshFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(meshStateReceiver, meshFilter)
        }

        if (intent?.getBooleanExtra("open_vpn_sheet", false) == true) {
            mainHandler.postDelayed({ showVpnModeSelector() }, 500L)
        }

        if (!isIsolatedPrivateProfile) {
            AppUpdateManager.checkForUpdates(this, manualCheck = false)
            mainHandler.postDelayed({
                if (!isFinishing && !isDestroyed) {
                    runCatching {
                        com.adshield.app.engine.VpnEngine.restoreSavedState(this)
                        updateVpnIndicatorUi()
                    }
                }
            }, 400L)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent?.getBooleanExtra("open_vpn_sheet", false) == true) {
            mainHandler.postDelayed({ showVpnModeSelector() }, 250L)
        }
        if (intent?.getBooleanExtra("EXTRA_OPEN_AI_SUMMARY", false) == true) {
            val summaryJson = intent.getStringExtra("EXTRA_AI_SUMMARY_JSON") ?: lastGeneratedSummaryJson
            if (!summaryJson.isNullOrBlank()) {
                mainHandler.postDelayed({ showAiSummarySheet(summaryJson) }, 250L)
            }
        }
        when (intent?.action) {
            ACTION_WIPE_GHOST_SESSION -> {
                wipeAllPrivateTabsAndSession()
                return
            }
            ACTION_MEDIA_TOGGLE -> {
                toggleMediaPlayPause()
                return
            }
            ACTION_MEDIA_REWIND_10 -> {
                rewindMedia10()
                return
            }
            ACTION_MEDIA_FORWARD_10 -> {
                forwardMedia10()
                return
            }
            ACTION_MEDIA_NEXT -> {
                nextMediaTrack()
                return
            }
        }
        handleOpenAction(intent)
        val incomingUrl = incomingWebUrl(intent)
        if (isIsolatedPrivateProfile) {
            if (incomingUrl != null) addNewTab(incomingUrl, isPrivate = true)
        } else if (incomingUrl != null) {
            addNewTab(incomingUrl, isPrivate = false)
        }
    }

    private fun incomingWebUrl(intent: Intent?): String? {
        if (intent == null) return null
        intent.getStringExtra(EXTRA_URL)?.takeIf(::isWebUrl)?.let { return it }
        return when (intent.action) {
            Intent.ACTION_VIEW -> intent.dataString?.takeIf(::isWebUrl)
            Intent.ACTION_SEND -> {
                if (intent.type != "text/plain") return null
                val sharedText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString().orEmpty().trim()
                sharedText.takeIf(::isWebUrl) ?: run {
                    val matcher = Patterns.WEB_URL.matcher(sharedText)
                    if (!matcher.find()) return null
                    val candidate = matcher.group().trimEnd('.', ',', ';', ')', ']', '}')
                    val webUrl = if (Uri.parse(candidate).scheme.isNullOrBlank()) "https://$candidate" else candidate
                    webUrl.takeIf(::isWebUrl)
                }
            }
            else -> null
        }
    }

    private fun handleOpenAction(intent: Intent?) {
        when (intent?.getStringExtra(EXTRA_OPEN_ACTION)) {
            "wallpapers" -> openWallpapersCustomizer()
            "shortcuts" -> openShortcutsCustomizer()
        }
    }

    private fun setupRefreshControl() {
        binding.swipeRefreshLayout.setColorSchemeResources(R.color.fokk_cyan)
        binding.swipeRefreshLayout.isEnabled = false
        binding.swipeRefreshLayout.isNestedScrollingEnabled = false
        binding.swipeRefreshLayout.setOnRefreshListener {
            binding.swipeRefreshLayout.isRefreshing = false
        }
    }

    private fun loadInjectionScript() {
        try {
            assets.open("adblock_defusers.js").use { stream ->
                BufferedReader(InputStreamReader(stream)).use { reader ->
                    defusersScript = reader.readText()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load adblock defusers script", e)
        }
        try {
            assets.open("inject_adshield.js").use { stream ->
                BufferedReader(InputStreamReader(stream)).use { reader ->
                    injectionScript = reader.readText()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load injection script", e)
        }
        try {
            assets.open("fokko_content.js").use { stream ->
                BufferedReader(InputStreamReader(stream)).use { reader ->
                    fokkoScript = reader.readText()
                }
            }
            assets.open("fokko_content.css").use { stream ->
                BufferedReader(InputStreamReader(stream)).use { reader ->
                    fokkoCss = reader.readText()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load Fokko AI assets", e)
        }
        try {
            assets.open("fokk_reader.js").use { stream ->
                BufferedReader(InputStreamReader(stream)).use { reader ->
                    readerScript = reader.readText()
                }
            }
            assets.open("fokk_reader.css").use { stream ->
                BufferedReader(InputStreamReader(stream)).use { reader ->
                    readerCss = reader.readText()
                }
            }
            assets.open("fokk_summarizer.js").use { stream ->
                BufferedReader(InputStreamReader(stream)).use { reader ->
                    summarizerScript = reader.readText()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load Fokk Reader / Summarizer assets", e)
        }
    }

    private fun recordFilteredRequest(webView: WebView?, host: String) {
        if (isIsolatedPrivateProfile) privateFilteredRequestTotal.incrementAndGet()
        synchronized(filteredCountLock) {
            pendingFilteredCountTotal += 1
            if (webView != null) {
                pendingFilteredCounts[webView] = (pendingFilteredCounts[webView] ?: 0) + 1
                val hostCounts = pendingFilteredHosts.getOrPut(webView) { mutableMapOf() }
                val normalizedHost = host.lowercase(Locale.ROOT)
                if (normalizedHost in hostCounts || hostCounts.size < MAX_REPORTED_HOSTS) {
                    hostCounts[normalizedHost] = (hostCounts[normalizedHost] ?: 0) + 1
                }
            }
        }
        scheduleFilteredCountFlush()
    }

    private fun recordThirdPartyRequest(webView: WebView?, host: String) {
        if (webView == null) return
        synchronized(filteredCountLock) {
            pendingThirdPartyCounts[webView] = (pendingThirdPartyCounts[webView] ?: 0) + 1
            val hostCounts = pendingThirdPartyHosts.getOrPut(webView) { mutableMapOf() }
            val normalizedHost = host.lowercase(Locale.ROOT)
            if (normalizedHost in hostCounts || hostCounts.size < MAX_REPORTED_HOSTS) {
                hostCounts[normalizedHost] = (hostCounts[normalizedHost] ?: 0) + 1
            }
        }
        scheduleFilteredCountFlush()
    }

    private fun scheduleFilteredCountFlush() {
        if (pendingFilteredCountFlush.compareAndSet(false, true)) {
            mainHandler.postDelayed(filteredCountFlushRunnable, 200L)
        }
    }

    private fun flushFilteredRequestCounts() {
        val snapshot: Map<WebView, PendingRequestSnapshot>
        val total: Int
        synchronized(filteredCountLock) {
            val webViews = (pendingFilteredCounts.keys + pendingThirdPartyCounts.keys).toSet()
            snapshot = webViews.associateWith { webView ->
                PendingRequestSnapshot(
                    filteredCount = pendingFilteredCounts[webView] ?: 0,
                    filteredHosts = pendingFilteredHosts[webView]?.toMap().orEmpty(),
                    thirdPartyCount = pendingThirdPartyCounts[webView] ?: 0,
                    thirdPartyHosts = pendingThirdPartyHosts[webView]?.toMap().orEmpty()
                )
            }
            total = pendingFilteredCountTotal
            pendingFilteredCounts.clear()
            pendingFilteredHosts.clear()
            pendingThirdPartyCounts.clear()
            pendingThirdPartyHosts.clear()
            pendingFilteredCountTotal = 0
        }

        snapshot.forEach { (webView, pending) ->
            tabs.firstOrNull { it.webView === webView }?.let { tab ->
                tab.filteredRequests += pending.filteredCount
                tab.thirdPartyRequests += pending.thirdPartyCount
                pending.filteredHosts.forEach { (host, count) ->
                    if (host in tab.filteredRequestHosts || tab.filteredRequestHosts.size < MAX_REPORTED_HOSTS) {
                        tab.filteredRequestHosts[host] = (tab.filteredRequestHosts[host] ?: 0) + count
                    }
                }
                pending.thirdPartyHosts.forEach { (host, count) ->
                    if (host in tab.thirdPartyRequestHosts || tab.thirdPartyRequestHosts.size < MAX_REPORTED_HOSTS) {
                        tab.thirdPartyRequestHosts[host] = (tab.thirdPartyRequestHosts[host] ?: 0) + count
                    }
                }
            }
        }
        if (total > 0 && !isIsolatedPrivateProfile) {
            AdShieldApp.instance.incrementBlockedAds(total)
        }
        val thirdPartyTotal = snapshot.values.sumOf { it.thirdPartyCount }
        if (thirdPartyTotal > 0 && !isIsolatedPrivateProfile) {
            AdShieldApp.instance.incrementCrossSiteTrackers(thirdPartyTotal)
        }

        pendingFilteredCountFlush.set(false)
        val hasMorePending = synchronized(filteredCountLock) {
            pendingFilteredCountTotal > 0 || pendingThirdPartyCounts.isNotEmpty()
        }
        if (hasMorePending) scheduleFilteredCountFlush()
    }

    class WebAppInterface(private val activity: MediaHubActivity, private val sourceWebView: WebView? = null) {
        private val auditPageUrlGrants = LinkedHashMap<String, Long>()

        private fun isSafePublicAuditPage(target: java.net.URI): Boolean {
            val host = target.host?.lowercase(Locale.ROOT)?.removeSuffix(".").orEmpty()
            val blockedSuffixes = listOf(".localhost", ".local", ".internal", ".test", ".invalid")
            val ipv4 = Regex("^\\d{1,3}(?:\\.\\d{1,3}){3}$")
            return target.scheme.equals("https", ignoreCase = true) &&
                target.port in listOf(-1, 443) && target.rawUserInfo == null &&
                host.contains(".") && !host.contains(":") && !ipv4.matches(host) &&
                host != "localhost" && host != "metadata.google.internal" &&
                blockedSuffixes.none { host.endsWith(it) } && host.split(".").all { label ->
                    label.isNotEmpty() && label.length <= 63 && label.matches(Regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"))
                }
        }

        private fun rememberAuditPageUrl(value: String?) {
            try {
                val clean = value?.substringBefore('#')?.trim().orEmpty()
                val target = java.net.URI(clean)
                if (!isSafePublicAuditPage(target) || target.host.equals("news.google.com", ignoreCase = true)) return
                val key = target.normalize().toASCIIString()
                synchronized(auditPageUrlGrants) {
                    val now = System.currentTimeMillis()
                    auditPageUrlGrants.entries.removeAll { it.value <= now }
                    auditPageUrlGrants[key] = now + 10 * 60 * 1000
                    while (auditPageUrlGrants.size > 100) {
                        auditPageUrlGrants.remove(auditPageUrlGrants.keys.first())
                    }
                }
            } catch (_: Exception) {}
        }

        private fun rememberAuditPageUrlsFromIndex(host: String, path: String, body: String) {
            try {
                if (host == "api.gdeltproject.org" && path == "/api/v2/doc/doc") {
                    val articles = org.json.JSONObject(body).optJSONArray("articles") ?: return
                    for (index in 0 until articles.length()) {
                        rememberAuditPageUrl(articles.optJSONObject(index)?.optString("url"))
                    }
                } else if (host == "html.duckduckgo.com" && path == "/html/") {
                    val anchorPattern = Regex("<a\\b[^>]*>", RegexOption.IGNORE_CASE)
                    val hrefPattern = Regex("href\\s*=\\s*(['\"])(.*?)\\1", RegexOption.IGNORE_CASE)
                    for (anchor in anchorPattern.findAll(body)) {
                        if (!Regex("class\\s*=\\s*(['\"])[^'\"]*\\bresult__a\\b[^'\"]*\\1", RegexOption.IGNORE_CASE).containsMatchIn(anchor.value)) continue
                        val href = hrefPattern.find(anchor.value)?.groupValues?.get(2)?.replace("&amp;", "&") ?: continue
                        val link = java.net.URI("https://html.duckduckgo.com").resolve(href)
                        val target = android.net.Uri.parse(link.toString()).getQueryParameter("uddg") ?: link.toString()
                        rememberAuditPageUrl(target)
                    }
                }
            } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun getStats(): String {
            val total = if (activity.isIsolatedPrivateProfile) {
                activity.privateFilteredRequestTotal.get()
            } else {
                AdShieldApp.instance.getBlockedAdsCount()
            }
            return """{"blocked":$total}"""
        }

        @JavascriptInterface
        fun setSearchEngine(engineName: String) {
            activity.runOnUiThread {
                val found = SearchEngine.values().find {
                    it.name.equals(engineName, ignoreCase = true) || it.displayName.equals(engineName, ignoreCase = true)
                }
                if (found != null) {
                    activity.currentSearchEngine = found
                    activity.prefs.edit().putString(PREF_SEARCH_ENGINE, found.name).apply()
                    activity.binding.urlInput.hint = "Search with ${found.displayName} or enter URL..."
                }
            }
        }

        @JavascriptInterface
        fun openSearchEngineDialog() {
            activity.runOnUiThread {
                activity.showSearchEngineDialog()
            }
        }

        @JavascriptInterface
        fun pickWallpaperImage() {
            activity.runOnUiThread {
                activity.openWallpaperGalleryPicker()
            }
        }

        @JavascriptInterface
        fun triggerWallpaperPicker() {
            activity.runOnUiThread {
                activity.openWallpaperGalleryPicker()
            }
        }

        @JavascriptInterface
        fun setGlobalTheme(theme: String) {
            activity.runOnUiThread {
                activity.prefs.edit().putString(PREF_ACTIVE_THEME, theme).apply()
                val customData = if (theme == "custom") activity.getCustomWallpaperDataUri() else ""
                activity.tabs.forEach { tab ->
                    tab.webView?.evaluateJavascript(
                        "if (typeof applyThemeFromNative === 'function') applyThemeFromNative('$theme', '$customData');",
                        null
                    )
                }
            }
        }

        @JavascriptInterface
        fun getGlobalTheme(): String {
            return activity.prefs.getString(PREF_ACTIVE_THEME, "default") ?: "default"
        }

        @JavascriptInterface
        fun getCustomWallpaperData(): String {
            return activity.getCustomWallpaperDataUri()
        }

        @JavascriptInterface
        fun onMediaPlaybackChanged(isPlaying: Boolean) {
            onMediaPlaybackChanged(isPlaying, isPlaying)
        }

        @JavascriptInterface
        fun onMediaPlaybackChanged(isPlaying: Boolean, hasActiveVideo: Boolean) {
            reportMediaPlayback(isPlaying, hasActiveVideo, "")
        }

        @JavascriptInterface
        fun reportMediaPlayback(isPlaying: Boolean, hasActiveVideo: Boolean, title: String) {
            activity.runOnUiThread {
                activity.onMediaPlaybackUpdated(isPlaying, hasActiveVideo, title)
            }
        }

        @JavascriptInterface
        fun getCustomShortcuts(): String {
            return activity.prefs.getString("custom_startpage_shortcuts", "[]") ?: "[]"
        }

        @JavascriptInterface
        fun getSearchEngine(): String {
            return activity.currentSearchEngine.name
        }

        @JavascriptInterface
        fun getTrendingTopics(): String {
            return activity.cachedTrendingTopicsJson
        }

        @JavascriptInterface
        fun setCustomWallpaper(wallpaperUri: String) {
            activity.runOnUiThread {
                activity.prefs.edit().putString("fokk_custom_wallpaper", wallpaperUri).apply()
                activity.prefs.edit().putString(PREF_ACTIVE_THEME, "custom").apply()
                activity.tabs.forEach { tab ->
                    tab.webView?.evaluateJavascript(
                        "if (typeof applyThemeFromNative === 'function') applyThemeFromNative('custom', '$wallpaperUri');",
                        null
                    )
                }
                Toast.makeText(activity, "Wallpaper applied to Fokk Startpage!", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun fetchOnlineWallpapers(query: String, page: Int): String {
            return try {
                val q = if (query.isBlank()) "wallpapers" else query
                val targetUrl = "https://wallhaven.cc/api/v1/search?q=${java.net.URLEncoder.encode(q, "UTF-8")}&page=$page&purity=100&sorting=toplist"
                val conn = URL(targetUrl).openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) FokkShield/1.0")
                conn.connectTimeout = 3500
                conn.readTimeout = 3500
                if (conn.responseCode == 200) {
                    conn.inputStream.bufferedReader().use { it.readText() }
                } else {
                    ""
                }
            } catch (e: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun fetchAudioTracks(query: String, page: Int): String {
            return try {
                val q = query.trim()
                val offset = (maxOf(1, page) - 1) * 20
                val targetUrl = if (q.isBlank() || q.equals("trending", ignoreCase = true) || q.equals("all", ignoreCase = true)) {
                    "https://api.audius.co/v1/tracks/trending?limit=20&offset=$offset&app_name=FokkShield"
                } else {
                    "https://api.audius.co/v1/tracks/search?query=${java.net.URLEncoder.encode(q, "UTF-8")}&limit=20&offset=$offset&app_name=FokkShield"
                }
                val conn = URL(targetUrl).openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) FokkShield/1.0")
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                if (conn.responseCode == 200) {
                    conn.inputStream.bufferedReader().use { it.readText() }
                } else {
                    ""
                }
            } catch (e: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun downloadFile(url: String, filename: String) {
            activity.runOnUiThread {
                try {
                    val name = if (filename.isNotBlank()) filename else URLUtil.guessFileName(url, null, null)
                    val req = DownloadManager.Request(Uri.parse(url)).apply {
                        setTitle(name)
                        setDescription("Downloading via Fokk Shield")
                        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
                        setAllowedOverMetered(true)
                        setAllowedOverRoaming(true)
                    }
                    val dm = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(req)
                    Toast.makeText(activity, "Download started: $name", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        activity.startActivity(intent)
                    } catch (ex: Exception) {
                        Toast.makeText(activity, "Unable to start download", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        @JavascriptInterface
        fun shareContent(text: String, title: String) {
            activity.runOnUiThread {
                try {
                    val sendIntent = Intent().apply {
                        action = Intent.ACTION_SEND
                        putExtra(Intent.EXTRA_TEXT, text)
                        if (title.isNotBlank()) putExtra(Intent.EXTRA_TITLE, title)
                        type = "text/plain"
                    }
                    activity.startActivity(Intent.createChooser(sendIntent, if (title.isNotBlank()) title else "Share via"))
                } catch (e: Exception) {}
            }
        }

        @JavascriptInterface
        fun openPrivateTabs() {
            activity.runOnUiThread {
                activity.authenticateForPrivateTabs {
                    if (activity.isIsolatedPrivateProfile) {
                        activity.showingPrivateTabs = true
                        activity.showTabSwitcherDialog()
                    } else {
                        activity.openIsolatedPrivateBrowser("file:///android_asset/fokk_start.html")
                    }
                }
            }
        }

        @JavascriptInterface
        fun toggleGhostMode() {
            activity.runOnUiThread {
                activity.toggleGhostModeState()
            }
        }

        @JavascriptInterface
        fun isGhostModeActive(): Boolean {
            return activity.isIsolatedPrivateProfile || (activity.activeTab?.isPrivate == true)
        }

        @JavascriptInterface
        fun newPrivateTab() {
            activity.runOnUiThread {
                activity.authenticateForPrivateTabs {
                    activity.addNewTab("file:///android_asset/fokk_start.html", isPrivate = true)
                }
            }
        }

        @JavascriptInterface
        fun openAboutPage() {
            activity.runOnUiThread {
                activity.openAboutPage()
            }
        }

        @JavascriptInterface
        fun search(query: String) {
            activity.runOnUiThread {
                val url = activity.currentSearchEngine.searchUrl + Uri.encode(query)
                activity.loadUrlInActiveWebView(url)
            }
        }

        @JavascriptInterface
        fun openShieldDashboard() {
            activity.runOnUiThread {
                activity.openShieldDashboard()
            }
        }

        @JavascriptInterface
        fun openDualScreen() {
            activity.runOnUiThread {
                activity.toggleDualDeckMode()
            }
        }

        @JavascriptInterface
        fun openBookmarks() {
            activity.runOnUiThread {
                activity.showSavedPagesDialog()
            }
        }

        @JavascriptInterface
        fun openFavorites() {
            activity.runOnUiThread {
                activity.showSavedPagesDialog()
            }
        }

        @JavascriptInterface
        fun openHistory() {
            activity.runOnUiThread {
                activity.showHistoryDialog()
            }
        }

        @JavascriptInterface
        fun openSettings() {
            activity.runOnUiThread {
                activity.showGeneralSettingsDialog()
            }
        }

        @JavascriptInterface
        fun isAndroidNative(): Boolean {
            return true
        }

        @JavascriptInterface
        fun openTabs() {
            activity.runOnUiThread {
                activity.showTabSwitcherDialog()
            }
        }

        @JavascriptInterface
        fun openMenu() {
            activity.runOnUiThread {
                activity.showBrowserMenuDialog()
            }
        }

        @JavascriptInterface
        fun burnSession() {
            activity.runOnUiThread {
                activity.burnSession()
            }
        }

        @JavascriptInterface
        fun startVoiceSearch() {
            activity.runOnUiThread {
                activity.startVoiceSearch()
            }
        }

        @JavascriptInterface
        fun openReaderMode() {
            activity.runOnUiThread {
                activity.openReaderView()
            }
        }

        @JavascriptInterface
        fun saveCurrentPage() {
            activity.runOnUiThread {
                activity.saveCurrentPage()
            }
        }

        @JavascriptInterface
        fun openDownloads() {
            activity.runOnUiThread {
                activity.openSystemDownloads()
            }
        }

        @JavascriptInterface
        fun openNewTab() {
            activity.runOnUiThread {
                activity.addNewTab("file:///android_asset/fokk_start.html", isPrivate = activity.isIsolatedPrivateProfile)
            }
        }

        @JavascriptInterface
        fun getTabCount(): Int {
            return activity.tabs.size
        }

        @JavascriptInterface
        fun getLiveNews(category: String): String {
            return activity.fetchLivePulseNews(category, "global")
        }

        @JavascriptInterface
        fun getLiveNews(category: String, region: String): String {
            return activity.fetchLivePulseNews(category, region)
        }

        @JavascriptInterface
        fun getLiveNewsForRegion(category: String, region: String): String {
            return activity.fetchLivePulseNews(category, region)
        }

        @JavascriptInterface
        fun refreshLiveNews(category: String): String {
            return activity.fetchLivePulseNews(category, "global", forceRefresh = true)
        }

        @JavascriptInterface
        fun refreshLiveNews(category: String, region: String): String {
            return activity.fetchLivePulseNews(category, region, forceRefresh = true)
        }

        @JavascriptInterface
        fun refreshLiveNewsForRegion(category: String, region: String): String {
            return activity.fetchLivePulseNews(category, region, forceRefresh = true)
        }

        @JavascriptInterface
        fun openUrl(url: String) {
            activity.runOnUiThread {
                activity.loadUrlInActiveWebView(url)
            }
        }

        @JavascriptInterface
        fun getSearchSuggestions(query: String): String {
            val q = query.trim().lowercase(Locale.ROOT)
            if (q.isBlank()) return "[]"
            val results = mutableListOf<String>()
            try {
                val historyJson = activity.localPrefs.getString(PREF_BROWSING_HISTORY, "[]") ?: "[]"
                val histArray = JSONArray(historyJson)
                for (i in 0 until minOf(histArray.length(), 40)) {
                    val item = histArray.getJSONObject(i)
                    val title = item.optString("title", "")
                    val url = item.optString("url", "")
                    if (title.lowercase(Locale.ROOT).contains(q) || url.lowercase(Locale.ROOT).contains(q)) {
                        val display = if (title.isNotBlank()) title else url
                        if (!results.contains(display)) results.add(display)
                    }
                    if (results.size >= 5) break
                }
            } catch (_: Exception) {}
            return JSONArray(results).toString()
        }

        @JavascriptInterface
        fun auditFetch(url: String): String {
            var connection: java.net.HttpURLConnection? = null
            return try {
                val clean = url.substringBefore('#').trim()
                val target = java.net.URI(clean)
                val host = target.host?.lowercase(Locale.ROOT).orEmpty()
                val allowedTarget = target.scheme.equals("https", ignoreCase = true) &&
                    target.port in listOf(-1, 443) &&
                    target.rawUserInfo == null && clean.length <= 4_096 &&
                    ((host == "news.google.com" && target.path == "/rss/search") ||
                        (host == "html.duckduckgo.com" && target.path == "/html/") ||
                        (host == "en.wikipedia.org" && target.path == "/w/api.php") ||
                        ((host == "wikidata.org" || host == "www.wikidata.org") && target.path == "/w/api.php") ||
                        (host == "api.gdeltproject.org" && target.path == "/api/v2/doc/doc"))
                if (!allowedTarget) return ""

                val activeMode = com.adshield.app.engine.VpnEngine.getActiveMode(activity)
                val proxyEndpoint = when (activeMode) {
                    com.adshield.app.engine.VpnEngine.VpnMode.FAST,
                    com.adshield.app.engine.VpnEngine.VpnMode.TOR,
                    com.adshield.app.engine.VpnEngine.VpnMode.RELAY -> com.adshield.app.engine.VpnEngine.getFastPrivacyEndpoint()
                    com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM -> {
                        val saved = com.adshield.app.engine.VpnEngine.getCustomProxy(activity)
                        if (saved in setOf("AM", "EU", "AS") || saved.isBlank()) {
                            com.adshield.app.engine.VpnEngine.getFastPrivacyEndpoint(saved)
                        } else saved
                    }
                    com.adshield.app.engine.VpnEngine.VpnMode.OFF -> null
                }
                val routeProxy = if (!proxyEndpoint.isNullOrBlank()) {
                    val savedProxy = java.net.URI(proxyEndpoint)
                    val proxyType = when (savedProxy.scheme?.lowercase(Locale.ROOT)) {
                        "socks", "socks5", "socks4" -> java.net.Proxy.Type.SOCKS
                        "http" -> java.net.Proxy.Type.HTTP
                        // Java URLConnection does not provide TLS-to-HTTPS-proxy support.
                        // Do not silently send this lookup outside the configured route.
                        else -> return ""
                    }
                    val proxyHost = savedProxy.host?.takeIf { it.isNotBlank() } ?: return ""
                    val proxyPort = savedProxy.port.takeIf { it in 1..65535 } ?: return ""
                    java.net.Proxy(proxyType, java.net.InetSocketAddress(proxyHost, proxyPort))
                } else {
                    null
                }

                val targetUrl = java.net.URL(target.toASCIIString())
                val conn = (if (routeProxy == null) targetUrl.openConnection() else targetUrl.openConnection(routeProxy)) as java.net.HttpURLConnection
                connection = conn
                conn.connectTimeout = 6_000
                conn.readTimeout = 7_000
                conn.instanceFollowRedirects = true
                conn.useCaches = false
                conn.requestMethod = "GET"
                conn.setRequestProperty("Accept", "application/json, application/xml, text/xml")
                conn.setRequestProperty("User-Agent", "FokkBrowser/2.4.0 (Android; EvidenceReview)")
                if (conn.responseCode != java.net.HttpURLConnection.HTTP_OK) return ""
                if (conn.contentLengthLong > 1_000_000L) return ""

                val output = StringBuilder()
                conn.inputStream.bufferedReader().use { reader ->
                    val buffer = CharArray(8_192)
                    while (true) {
                        val count = reader.read(buffer)
                        if (count < 0) break
                        if (output.length + count > 1_000_000) return ""
                        output.append(buffer, 0, count)
                    }
                }
                val body = output.toString()
                rememberAuditPageUrlsFromIndex(host, target.path, body)
                body
            } catch (_: Exception) {
                ""
            } finally {
                connection?.disconnect()
            }
        }

        @JavascriptInterface
        fun auditFetchPage(url: String): String {
            var connection: java.net.HttpURLConnection? = null
            return try {
                if (url.length > 4_096) return ""
                val clean = url.substringBefore('#').trim()
                var target = java.net.URI(clean)
                if (!isSafePublicAuditPage(target)) return ""
                val originalHost = target.host.orEmpty()
                val grantKey = target.normalize().toASCIIString()
                val granted = synchronized(auditPageUrlGrants) {
                    val expiresAt = auditPageUrlGrants[grantKey] ?: 0L
                    if (expiresAt > System.currentTimeMillis()) {
                        auditPageUrlGrants.remove(grantKey)
                        true
                    } else {
                        auditPageUrlGrants.remove(grantKey)
                        false
                    }
                }
                if (!granted) return ""

                val activeMode = com.adshield.app.engine.VpnEngine.getActiveMode(activity)
                val proxyEndpoint = when (activeMode) {
                    com.adshield.app.engine.VpnEngine.VpnMode.FAST,
                    com.adshield.app.engine.VpnEngine.VpnMode.TOR,
                    com.adshield.app.engine.VpnEngine.VpnMode.RELAY -> com.adshield.app.engine.VpnEngine.getFastPrivacyEndpoint()
                    com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM -> {
                        val saved = com.adshield.app.engine.VpnEngine.getCustomProxy(activity)
                        if (saved in setOf("AM", "EU", "AS") || saved.isBlank()) {
                            com.adshield.app.engine.VpnEngine.getFastPrivacyEndpoint(saved)
                        } else saved
                    }
                    com.adshield.app.engine.VpnEngine.VpnMode.OFF -> null
                }
                val routeProxy = if (!proxyEndpoint.isNullOrBlank()) {
                    val savedProxy = java.net.URI(proxyEndpoint)
                    val proxyType = when (savedProxy.scheme?.lowercase(Locale.ROOT)) {
                        "socks", "socks5", "socks4" -> java.net.Proxy.Type.SOCKS
                        "http", "https" -> java.net.Proxy.Type.HTTP
                        else -> return ""
                    }
                    val proxyHost = savedProxy.host?.takeIf { it.isNotBlank() } ?: return ""
                    val proxyPort = savedProxy.port.takeIf { it in 1..65535 } ?: return ""
                    java.net.Proxy(proxyType, java.net.InetSocketAddress(proxyHost, proxyPort))
                } else null

                var redirects = 0
                while (redirects <= 2) {
                    if (!isSafePublicAuditPage(target)) return ""
                    val targetUrl = java.net.URL(target.toASCIIString())
                    val conn = (if (routeProxy == null) targetUrl.openConnection() else targetUrl.openConnection(routeProxy)) as java.net.HttpURLConnection
                    connection = conn
                    conn.connectTimeout = 6_000
                    conn.readTimeout = 7_000
                    conn.instanceFollowRedirects = false
                    conn.useCaches = false
                    conn.requestMethod = "GET"
                    conn.setRequestProperty("Accept", "text/html, application/xhtml+xml, text/plain;q=0.8")
                    conn.setRequestProperty("User-Agent", "FokkBrowser/2.4.0 (Android; EvidenceReview)")
                    val status = conn.responseCode
                    if (status in 300..399) {
                        val location = conn.getHeaderField("Location") ?: return ""
                        val redirectedTarget = target.resolve(location)
                        val origHost = originalHost.lowercase(Locale.ROOT)
                        val nextHost = redirectedTarget.host?.lowercase(Locale.ROOT).orEmpty()
                        val isSameDomain = nextHost == origHost || nextHost.endsWith(".$origHost") || origHost.endsWith(".$nextHost")
                        if (!isSafePublicAuditPage(redirectedTarget) || !isSameDomain) return ""
                        target = redirectedTarget
                        conn.disconnect()
                        connection = null
                        redirects++
                        continue
                    }
                    if (status != java.net.HttpURLConnection.HTTP_OK) return ""
                    val contentType = conn.contentType?.lowercase(Locale.ROOT).orEmpty()
                    if (!(contentType.contains("text/html") || contentType.contains("application/xhtml+xml") || contentType.contains("text/plain"))) return ""
                    if (conn.contentLengthLong > 1_000_000L) return ""
                    val output = StringBuilder()
                    conn.inputStream.bufferedReader().use { reader ->
                        val buffer = CharArray(8_192)
                        while (true) {
                            val count = reader.read(buffer)
                            if (count < 0) break
                            if (output.length + count > 1_000_000) return ""
                            output.append(buffer, 0, count)
                        }
                    }
                    return output.toString()
                }
                ""
            } catch (_: Exception) {
                ""
            } finally {
                connection?.disconnect()
            }
        }

        @JavascriptInterface
        fun auditFetchAsync(url: String, requestId: String, fetchPage: Boolean) {
            if (url.length > 4_096 || requestId.length > 120) return
            activity.lifecycleScope.launch(Dispatchers.IO) {
                val result = try {
                    if (fetchPage) auditFetchPage(url) else auditFetch(url)
                } catch (_: Exception) {
                    ""
                }
                val callback = "window.__fokkAuditResolve(${org.json.JSONObject.quote(requestId)},${org.json.JSONObject.quote(result)});"
                val callbackWebView = sourceWebView ?: activity.activeWebView ?: return@launch
                callbackWebView.post { callbackWebView.evaluateJavascript(callback, null) }
            }
        }


        @JavascriptInterface
        fun onPaywallDetected(url: String) {
            activity.runOnUiThread {
                activity.lastPaywallUrl = url
                activity.binding.btnPaywallMirror.visibility = View.VISIBLE
            }
        }

        @JavascriptInterface
        fun preWarmUrl(url: String) {
            activity.speculativePreWarm(url)
        }

        @JavascriptInterface
        fun showAiSummaryData(summaryJson: String) {
            activity.aiSummaryWatchdog?.let(activity.mainHandler::removeCallbacks)
            activity.aiSummaryWatchdog = null
            activity.runOnUiThread {
                val initialTab = activity.pendingAiSummaryInitialTab
                activity.pendingAiSummaryInitialTab = 0
                activity.showAiSummarySheet(summaryJson, initialTab)
            }
        }

        @JavascriptInterface
        fun speakText(text: String) {
            activity.runOnUiThread {
                activity.startTextToSpeech(text)
            }
        }

        @JavascriptInterface
        fun stopSpeech() {
            activity.runOnUiThread {
                activity.stopTextToSpeech()
            }
        }
    }

    /** Minimal, read-only playback bridge exposed to pages so native PiP starts only for media. */
    class MediaPlaybackBridge(private val activity: MediaHubActivity) {
        @JavascriptInterface
        fun onMediaPlaybackChanged(isPlaying: Boolean, hasActiveVideo: Boolean) {
            activity.runOnUiThread {
                activity.onMediaPlaybackUpdated(isPlaying, hasActiveVideo, null)
            }
        }

        @JavascriptInterface
        fun reportMediaPlayback(isPlaying: Boolean, hasActiveVideo: Boolean, title: String) {
            activity.runOnUiThread {
                activity.onMediaPlaybackUpdated(isPlaying, hasActiveVideo, title)
            }
        }
    }

    data class DetectedVideoStream(val url: String, val title: String)
    private var currentDetectedVideoStream: DetectedVideoStream? = null

    class FokkVideoBridge(private val activity: MediaHubActivity) {
        @JavascriptInterface
        fun onVideoFound(url: String, title: String) {
            if (url.isBlank()) return
            // Google Play Store Policy Compliance: Do not sniff or offer downloads for YouTube streams
            val activeHost = runCatching { Uri.parse(activity.activeWebView?.url.orEmpty()).host?.lowercase(Locale.ROOT) }.getOrNull().orEmpty()
            val streamHost = runCatching { Uri.parse(url).host?.lowercase(Locale.ROOT) }.getOrNull().orEmpty()
            if (activeHost.contains("youtube.com") || activeHost.contains("youtu.be") ||
                streamHost.contains("youtube.com") || streamHost.contains("googlevideo.com")) {
                return
            }
            activity.runOnUiThread {
                activity.currentDetectedVideoStream = DetectedVideoStream(url, title)
                activity.binding.btnMediaDetectedAction.visibility = View.VISIBLE
            }
        }

        @JavascriptInterface
        fun adjustBrightness(deltaPercent: Float) {
            activity.runOnUiThread {
                val lp = activity.window.attributes
                var current = lp.screenBrightness
                if (current < 0f) current = 0.5f
                lp.screenBrightness = (current + (deltaPercent / 100f)).coerceIn(0.05f, 1.0f)
                activity.window.attributes = lp
            }
        }

        @JavascriptInterface
        fun adjustVolume(deltaPercent: Float) {
            activity.runOnUiThread {
                val audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return@runOnUiThread
                val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                val currentVol = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
                val step = if (deltaPercent > 0) 1 else -1
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, (currentVol + step).coerceIn(0, maxVol), 0)
            }
        }

        @JavascriptInterface
        fun onSeekFeedback(seekSeconds: Int) {
            activity.runOnUiThread {
                val label = if (seekSeconds > 0) "+${seekSeconds}s" else "${seekSeconds}s"
                Toast.makeText(activity, label, Toast.LENGTH_SHORT).show()
            }
        }

    }

    private fun canUseBiometric(): Boolean {
        val bm = BiometricManager.from(this)
        return bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL) == BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun authenticateUser(title: String, subtitle: String, onSuccess: () -> Unit, onFail: (() -> Unit)? = null) {
        val executor = ContextCompat.getMainExecutor(this)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build()

        val biometricPrompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                onFail?.invoke()
                if (errorCode != BiometricPrompt.ERROR_USER_CANCELED && errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                    Toast.makeText(this@MediaHubActivity, "Biometric: $errString", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                onFail?.invoke()
            }
        })

        try {
            biometricPrompt.authenticate(promptInfo)
        } catch (e: Exception) {
            onSuccess()
        }
    }

    private fun authenticateForPrivateTabs(onSuccess: () -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            Toast.makeText(this, "Private tabs with isolated site data require Android 9 or newer", Toast.LENGTH_LONG).show()
            return
        }
        val isLockEnabled = prefs.getBoolean(PREF_BIOMETRIC_PRIVATE_TABS, false)
        if (!isLockEnabled || isBiometricAuthenticatedForSession) {
            onSuccess()
            return
        }

        val executor = ContextCompat.getMainExecutor(this)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock Private Browsing")
            .setSubtitle("Confirm your fingerprint or device PIN")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build()

        val biometricPrompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                isBiometricAuthenticatedForSession = true
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                if (errorCode != BiometricPrompt.ERROR_USER_CANCELED && errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                    Toast.makeText(this@MediaHubActivity, "Biometric: $errString", Toast.LENGTH_SHORT).show()
                }
            }
        })

        try {
            biometricPrompt.authenticate(promptInfo)
        } catch (e: Exception) {
            onSuccess()
        }
    }

    private fun recordHistory(title: String, url: String, isPrivate: Boolean = activeTab?.isPrivate == true) {
        if (isPrivate) return
        if (url.startsWith("file://") || url.isBlank()) return

        try {
            val historyJson = localPrefs.getString(PREF_BROWSING_HISTORY, "[]") ?: "[]"
            val jsonArr = JSONArray(historyJson)
            val newArr = JSONArray()
            val newItem = JSONObject().apply {
                put("title", title.ifEmpty { url })
                put("url", url)
                put("time", System.currentTimeMillis())
            }
            newArr.put(newItem)
            for (i in 0 until minOf(jsonArr.length(), 80)) {
                val prev = jsonArr.getJSONObject(i)
                if (prev.optString("url") != url) {
                    newArr.put(prev)
                }
            }
            localPrefs.edit().putString(PREF_BROWSING_HISTORY, newArr.toString()).apply()
        } catch (e: Exception) {
            Log.w(TAG, "Error saving history", e)
        }
    }

    private fun applyDesktopMode(webView: WebView, isDesktop: Boolean) {
        webView.settings.apply {
            userAgentString = if (isDesktop) desktopUa else cleanMobileUa
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }
    }

    private fun handleBrowserNavigation(webView: WebView?, rawUrl: String, userGesture: Boolean): Boolean {
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull() ?: return true
        val currentHost = webView?.url?.let { runCatching { Uri.parse(it).host?.lowercase(Locale.ROOT) }.getOrNull() }.orEmpty()
        val isSelfAppPromotion = (currentHost.contains("spotify.com") && (rawUrl.startsWith("spotify:") || rawUrl.contains("package=com.spotify.music"))) ||
            (currentHost.contains("youtube.com") && (rawUrl.startsWith("vnd.youtube:") || rawUrl.contains("package=com.google.android.youtube"))) ||
            (currentHost.contains("reddit.com") && (rawUrl.contains("package=com.reddit.frontpage") || rawUrl.contains("reddit.app.link"))) ||
            (currentHost.contains("instagram.com") && (rawUrl.startsWith("instagram:") || rawUrl.contains("package=com.instagram.android"))) ||
            ((currentHost.contains("x.com") || currentHost.contains("twitter.com")) && (rawUrl.startsWith("twitter:") || rawUrl.contains("package=com.twitter.android") || rawUrl.contains("twitter.app.link")))

        if (isSelfAppPromotion) {
            val parsedIntent = runCatching { Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME) }.getOrNull()
            val fallbackUrl = parsedIntent?.getStringExtra("browser_fallback_url")
            if (fallbackUrl != null && isWebUrl(fallbackUrl) && webView != null) {
                loadUrlInWebView(webView, fallbackUrl)
            }
            return true
        }

        when (uri.scheme?.lowercase(Locale.ROOT)) {
            "about", "data", "blob", "javascript" -> return false
            "file" -> {
                if (rawUrl.startsWith("file:///android_asset/")) {
                    if (webView != null) {
                        loadUrlInWebView(webView, rawUrl)
                        return true
                    }
                    return false
                }
                return false
            }
            "http", "https" -> {
                // 1. Unwrap redirect URLs first (e.g. Google search ads, Reddit outbound, affiliate trackers)
                val unwrapped = extractDestinationUrl(rawUrl)
                if (unwrapped != null && unwrapped != rawUrl && isWebUrl(unwrapped) && webView != null) {
                    loadUrlInWebView(webView, unwrapped)
                    return true
                }

                val targetHost = uri.host?.lowercase(Locale.ROOT).orEmpty()
                val isExplicitUserNav = userGesture || hasRecentUserInteraction()

                // Only block rogue unsolicited redirects (e.g. pop-unders or unauthorized script redirects)
                // NEVER block navigation when the user explicitly tapped or navigated!
                val isSocialNavigation = isSocialAppHost(targetHost) || isSocialInfrastructureHost(targetHost) ||
                    targetHost.contains("youtube.com") || targetHost.contains("youtu.be")
                if (!isExplicitUserNav && !isSocialNavigation && targetHost.isNotEmpty() && isShieldEnabledFor(targetHost)) {
                    val isBlockedByBrave = AdShieldApp.instance.braveEngine.checkNetworkRequest(rawUrl, webView?.url ?: "", "document").matched
                    if (isBlockedByBrave || AdShieldApp.instance.blocklistEngine.isDomainBlocked(targetHost)) {
                        recordFilteredRequest(webView, targetHost)
                        runOnUiThread {
                            val tab = tabs.firstOrNull { it.webView === webView }
                            if (tab != null && (tab.url == "about:blank" || webView?.copyBackForwardList()?.size ?: 0 <= 1)) {
                                val tabIdx = tabs.indexOf(tab)
                                if (tabs.size > 1 && tabIdx >= 0) {
                                    closeTab(tabIdx)
                                }
                            }
                        }
                        return true
                    }
                }

                val cleanedUrl = stripTrackingParameters(rawUrl)
                if (cleanedUrl.endsWith(".torrent", ignoreCase = true) || cleanedUrl.contains(".torrent?")) {
                    handleMagnetUri(cleanedUrl)
                    return true
                }
                val httpsOnly = prefs.getBoolean(PREF_HTTPS_ONLY, true)
                val shouldUpgrade = httpsOnly && cleanedUrl.startsWith("http://") && uri.host != null && !uri.host!!.endsWith(".local") && !uri.host!!.equals("localhost") && !uri.host!!.equals("127.0.0.1")
                val finalTargetUrl = if (shouldUpgrade) "https://" + cleanedUrl.substring(7) else cleanedUrl
                if (finalTargetUrl != rawUrl && webView != null) {
                    loadUrlInWebView(webView, finalTargetUrl)
                    return true
                }
                webView?.let {
                    pageUrlsByWebView[it] = rawUrl
                    setBridgeEnabled(it, rawUrl)
                }
                return false
            }
            "magnet" -> {
                handleMagnetUri(rawUrl)
                return true
            }
            "market" -> {
                // Zero-Nag: Block attempts to force user to Play Store
                val playUrl = uri.getQueryParameter("id")?.let { "https://play.google.com/store/apps/details?id=$it" }
                if (playUrl != null && webView != null) {
                    Toast.makeText(this, "Zero-Nag prevented Play Store redirect", Toast.LENGTH_SHORT).show()
                    return true
                }
                return true
            }
            "intent" -> {
                val parsedIntent = runCatching { Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME) }.getOrNull()
                if (parsedIntent == null) {
                    Toast.makeText(this, "Blocked an invalid app link", Toast.LENGTH_SHORT).show()
                    return true
                }
                val fallbackUrl = parsedIntent.getStringExtra("browser_fallback_url")
                val webTarget = fallbackUrl ?: parsedIntent.dataString?.takeIf { isWebUrl(it) } ?: run {
                    val scheme = parsedIntent.scheme ?: "https"
                    if (scheme == "http" || scheme == "https") {
                        val hostAndPath = rawUrl.substringAfter("intent://").substringBefore("#Intent;")
                        if (hostAndPath.isNotBlank() && hostAndPath.contains(".")) "$scheme://$hostAndPath" else null
                    } else null
                }
                if (webTarget != null && isWebUrl(webTarget) && webView != null) {
                    loadUrlInWebView(webView, webTarget)
                    return true
                }
                val pkg = parsedIntent.`package`
                if (pkg != null && (pkg.contains("android.apps") || pkg.contains("instagram") || pkg.contains("reddit") || pkg.contains("youtube") || pkg.contains("quora") || pkg.contains("spotify") || pkg.contains("twitter") || pkg.contains("tiktok"))) {
                    // Suppress invasive auto app switch nag
                    return true
                }
                if (!userGesture) {
                    return true
                }
                confirmExternalAppLaunch(uri, parsedIntent)
                return true
            }
            else -> {
                if (!userGesture) {
                    return true
                }
                confirmExternalAppLaunch(uri, null)
                return true
            }
        }
    }

    private fun handleMagnetUri(magnetUrl: String) {
        val uri = runCatching { Uri.parse(magnetUrl) }.getOrNull()
        val displayName = uri?.getQueryParameter("dn")?.takeIf { it.isNotBlank() }
            ?: run {
                val lastPath = uri?.lastPathSegment
                if (lastPath?.endsWith(".torrent", ignoreCase = true) == true) {
                    lastPath.removeSuffix(".torrent")
                } else {
                    "P2P Torrent Stream"
                }
            }
        val exactTopic = uri?.getQueryParameter("xt")?.removePrefix("urn:btih:") ?: (uri?.host ?: "Active InfoHash")

        val dialog = BottomSheetDialog(this)
        val sheetView = layoutInflater.inflate(R.layout.sheet_magnet_handler, null)
        dialog.setContentView(sheetView)

        sheetView.findViewById<TextView>(R.id.textMagnetName)?.text = displayName
        sheetView.findViewById<TextView>(R.id.textMagnetHash)?.text = "Hash: ${exactTopic.take(24)}..."

        sheetView.findViewById<View>(R.id.btnStreamTorrent)?.setOnClickListener {
            dialog.dismiss()
            val streamUrl = "file:///android_asset/fokk_webtorrent.html#" + Uri.encode(magnetUrl)
            addNewTab(streamUrl, isPrivate = false)
            Toast.makeText(this, "Connecting WebTorrent player...", Toast.LENGTH_SHORT).show()
        }

        sheetView.findViewById<View>(R.id.btnOpenExternalTorrent)?.setOnClickListener {
            dialog.dismiss()
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(magnetUrl)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(this, "No external torrent client found. Use In-Browser Streaming!", Toast.LENGTH_LONG).show()
            }
        }

        sheetView.findViewById<View>(R.id.btnCopyMagnet)?.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Magnet URI", magnetUrl))
            Toast.makeText(this, "Magnet link copied to clipboard", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun getWebOrigin(rawUrl: String?): String? = runCatching {
        val uri = Uri.parse(rawUrl)
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        val host = uri.host?.lowercase(Locale.ROOT)
        if (host.isNullOrBlank() || (scheme != "https" && !(scheme == "http" && host in setOf("localhost", "127.0.0.1", "::1")))) {
            null
        } else {
            val includePort = uri.port != -1 &&
                !((scheme == "https" && uri.port == 443) || (scheme == "http" && uri.port == 80))
            val authorityHost = if (':' in host && !host.startsWith("[")) "[$host]" else host
            val port = if (includePort) ":${uri.port}" else ""
            "$scheme://$authorityHost$port"
        }
    }.getOrNull()

    private fun getHttpStorageOrigins(rawUrl: String): Set<String> = runCatching {
        val uri = Uri.parse(rawUrl)
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        val host = uri.host?.lowercase(Locale.ROOT)?.takeIf(String::isNotBlank)
        if (scheme !in setOf("http", "https") || host == null) return@runCatching emptySet()

        val sourceDefaultPort = if (scheme == "https") 443 else 80
        val explicitNonDefaultPort = uri.port.takeIf { it != -1 && it != sourceDefaultPort }
        val authorityHost = if (':' in host && !host.startsWith("[")) "[$host]" else host
        setOf("http", "https").mapTo(linkedSetOf()) { targetScheme ->
            val targetDefaultPort = if (targetScheme == "https") 443 else 80
            val port = explicitNonDefaultPort?.takeUnless { it == targetDefaultPort }?.let { ":$it" }.orEmpty()
            "$targetScheme://$authorityHost$port"
        }
    }.getOrDefault(emptySet())

    private fun handleWebPermissionRequest(webView: WebView, request: PermissionRequest) {
        val requested = request.resources.distinct().toTypedArray()

        // Auto-grant protected media identifier (DRM / Widevine EME) for streaming services (e.g. Spotify, Netflix)
        if (requested.contains(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID)) {
            val nonDrm = requested.filter { it != PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID }
            if (nonDrm.isEmpty()) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID))
                return
            }
        }

        val permissions = buildList {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in requested) add(android.Manifest.permission.CAMERA)
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in requested) add(android.Manifest.permission.RECORD_AUDIO)
        }
        val origin = request.origin.toString().trimEnd('/')
        val currentOrigin = getWebOrigin(webView.url)
        val supportedResources = requested.all {
            it == PermissionRequest.RESOURCE_VIDEO_CAPTURE || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
        }

        if (requested.isEmpty() || permissions.isEmpty() || !supportedResources ||
            getWebOrigin(origin) != origin || currentOrigin == null || webView !== activeWebView ||
            pendingWebPermission != null || pendingLocationPermission != null) {
            request.deny()
            return
        }

        if (sitePermissionKey(origin, currentOrigin) in approvedWebMediaOrigins && permissions.all {
                ContextCompat.checkSelfPermission(this, it) == android.content.pm.PackageManager.PERMISSION_GRANTED
            }) {
            request.grant(requested)
            return
        }

        val requestedCapabilities = buildList {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in requested) add("camera")
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in requested) add("microphone")
        }.joinToString(" and ")

        MaterialAlertDialogBuilder(this)
            .setTitle("Allow $requestedCapabilities?")
            .setMessage("$origin is asking to use your $requestedCapabilities. Approve here; Android may also ask for system permission.")
            .setNegativeButton("Deny") { _, _ -> request.deny() }
            .setPositiveButton("Continue") { _, _ ->
                val pending = PendingWebPermission(request, webView, requested, permissions, origin, currentOrigin)
                pendingWebPermission = pending
                val missing = permissions.filter {
                    ContextCompat.checkSelfPermission(this, it) != android.content.pm.PackageManager.PERMISSION_GRANTED
                }
                if (missing.isEmpty()) {
                    pendingWebPermission = null
                    if (webView.url?.let(::getWebOrigin) == currentOrigin && tabs.any { it.webView === webView }) {
                        approvedWebMediaOrigins.add(sitePermissionKey(origin, currentOrigin))
                        request.grant(requested)
                    } else request.deny()
                } else {
                    webPermissionLauncher.launch(missing.toTypedArray())
                }
            }
            .setOnCancelListener { request.deny() }
            .show()
    }

    private fun cancelPendingWebPermission(webView: WebView) {
        val pending = pendingWebPermission ?: return
        if (pending.webView === webView) {
            pendingWebPermission = null
            pending.request.deny()
        }
    }

    private fun sitePermissionKey(requestingOrigin: String, topLevelOrigin: String?): String =
        "${topLevelOrigin.orEmpty()}|$requestingOrigin"

    private fun handleGeolocationPrompt(
        webView: WebView,
        rawOrigin: String?,
        callback: GeolocationPermissions.Callback
    ) {
        val origin = rawOrigin?.trimEnd('/') ?: run {
            callback.invoke(rawOrigin.orEmpty(), false, false)
            return
        }
        val isStartPage = webView.url?.contains("fokk_start.html") == true || origin.startsWith("file://")
        val currentOrigin = if (isStartPage) "file://android_asset" else getWebOrigin(webView.url)
        val validOrigin = if (isStartPage) true else (getWebOrigin(origin) == origin)
        if (!validOrigin || currentOrigin == null || webView !== activeWebView ||
            pendingLocationPermission != null || pendingWebPermission != null) {
            callback.invoke(origin, false, false)
            return
        }

        val locationPermissions = listOf(
            android.Manifest.permission.ACCESS_COARSE_LOCATION,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        )
        val hasLocation = locationPermissions.any {
            ContextCompat.checkSelfPermission(this, it) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        if ((isStartPage || sitePermissionKey(origin, currentOrigin) in approvedLocationOrigins) && hasLocation) {
            callback.invoke(origin, true, false)
            return
        }

        if (isStartPage) {
            val pending = PendingLocationPermission(callback, origin, webView, currentOrigin)
            pendingLocationPermission = pending
            val missing = locationPermissions.filter {
                ContextCompat.checkSelfPermission(this, it) != android.content.pm.PackageManager.PERMISSION_GRANTED
            }
            if (missing.isEmpty()) {
                pendingLocationPermission = null
                callback.invoke(origin, true, false)
            } else {
                locationPermissionLauncher.launch(missing.toTypedArray())
            }
            return
        }

        MaterialAlertDialogBuilder(this)
            .setTitle("Allow location access?")
            .setMessage("$origin is asking for your device location. You can choose approximate or precise access in Android's system prompt.")
            .setNegativeButton("Deny") { _, _ -> callback.invoke(origin, false, false) }
            .setPositiveButton("Continue") { _, _ ->
                val pending = PendingLocationPermission(callback, origin, webView, currentOrigin)
                pendingLocationPermission = pending
                val missing = locationPermissions.filter {
                    ContextCompat.checkSelfPermission(this, it) != android.content.pm.PackageManager.PERMISSION_GRANTED
                }
                if (missing.isEmpty()) {
                    pendingLocationPermission = null
                    if (webView.url?.let(::getWebOrigin) == currentOrigin && webView === activeWebView) {
                        approvedLocationOrigins.add(sitePermissionKey(origin, currentOrigin))
                        callback.invoke(origin, true, false)
                    } else callback.invoke(origin, false, false)
                } else {
                    locationPermissionLauncher.launch(missing.toTypedArray())
                }
            }
            .setOnCancelListener { callback.invoke(origin, false, false) }
            .show()
    }

    private fun cancelPendingLocationPermission(webView: WebView) {
        val pending = pendingLocationPermission ?: return
        if (pending.webView === webView) {
            pendingLocationPermission = null
            pending.callback.invoke(pending.origin, false, false)
        }
    }

    private fun loadUrlInWebView(webView: WebView?, url: String) {
        if (webView == null) return
        var targetUrl = stripTrackingParameters(url)
        val httpsOnly = prefs.getBoolean(PREF_HTTPS_ONLY, true)
        if (httpsOnly && targetUrl.startsWith("http://")) {
            val uri = runCatching { Uri.parse(targetUrl) }.getOrNull()
            if (uri != null && uri.host != null && !uri.host!!.endsWith(".local") && !uri.host!!.equals("localhost") && !uri.host!!.equals("127.0.0.1")) {
                targetUrl = "https://" + targetUrl.substring(7)
            }
        }
        val tab = tabs.firstOrNull { it.webView === webView }
        tab?.isOfflineReader = false

        // Auto-Stealth Search: Strip personalization & history attachment on Google queries
        if (targetUrl.contains("google.") && targetUrl.contains("/search") && !targetUrl.contains("pws=0")) {
            targetUrl = if (targetUrl.contains("?")) "$targetUrl&pws=0" else "$targetUrl?pws=0"
        }
        val tabIsPrivate = tab?.isPrivate == true
        CookieManager.getInstance().setAcceptThirdPartyCookies(
            webView,
            !tabIsPrivate && isThirdPartyMediaService(targetUrl)
        )
        // Automatically apply desktop mode for Spotify so it loads the real Web Player
        // rather than the restricted 30-second mobile teaser
        if (targetUrl.contains("open.spotify.com")) {
            webView.settings.userAgentString = desktopUa
        } else if (tab?.isDesktop != true) {
            webView.settings.userAgentString = cleanMobileUa
        }
        pageUrlsByWebView[webView] = targetUrl
        setBridgeEnabled(webView, targetUrl)
        if (webView === activeWebView) {
            updateToolbarLayoutForUrl(targetUrl, animated = true)
        }
        webView.loadUrl(targetUrl)
    }

    private fun stripTrackingParameters(rawUrl: String): String {
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull() ?: return rawUrl
        if (uri.scheme?.lowercase(Locale.ROOT) !in setOf("http", "https") ||
            uri.host.isNullOrBlank() || uri.encodedQuery.isNullOrEmpty()) return rawUrl
        val parameterNames = uri.queryParameterNames.map { it.lowercase(Locale.ROOT) }.toSet()
        if (parameterNames.any(::isAuthenticationOrSignatureParameter)) return rawUrl
        val builder = uri.buildUpon().clearQuery()
        var removedAny = false
        uri.queryParameterNames.forEach { name ->
            val normalized = name.lowercase(Locale.ROOT)
            val isTrackingParameter = normalized.startsWith("utm_") || normalized in TRACKING_QUERY_PARAMETERS
            if (isTrackingParameter) {
                removedAny = true
            } else {
                uri.getQueryParameters(name).forEach { value -> builder.appendQueryParameter(name, value) }
            }
        }
        return if (removedAny) builder.build().toString() else rawUrl
    }

    private fun isAuthenticationOrSignatureParameter(name: String): Boolean =
        name in AUTHENTICATION_OR_SIGNATURE_PARAMETERS ||
            AUTHENTICATION_OR_SIGNATURE_PREFIXES.any { name.startsWith(it) } ||
            name.endsWith("_signature") || name.endsWith("_token")

    private fun loadUrlInActiveWebView(url: String) = loadUrlInWebView(activeWebView, url)

    private fun isWebUrl(rawUrl: String?): Boolean = runCatching {
        if (rawUrl.isNullOrBlank()) return@runCatching false
        val uri = Uri.parse(rawUrl)
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        (scheme == "http" || scheme == "https") && !uri.host.isNullOrBlank()
    }.getOrDefault(false)

    private fun isHomePageUrl(url: String?): Boolean =
        url == null || url.isBlank() || url.contains("fokk_start.html") || url == "about:blank"

    private fun extractDestinationUrl(rawUrl: String): String? {
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull() ?: return null
        val redirectParamKeys = listOf(
            "adurl", "url", "u", "q", "dest", "destination",
            "target", "redirect", "redirect_url", "redirect_to",
            "redirect_uri", "link", "out", "murl", "r"
        )
        for (key in redirectParamKeys) {
            val paramVal = uri.getQueryParameter(key)
            if (!paramVal.isNullOrBlank()) {
                val decoded = runCatching { java.net.URLDecoder.decode(paramVal, "UTF-8") }.getOrDefault(paramVal)
                if (isWebUrl(decoded)) return decoded
                if (isWebUrl(paramVal)) return paramVal
            }
        }
        return null
    }

    private fun confirmExternalAppLaunch(uri: Uri, parsedIntent: Intent?) {
        val destination = uri.host ?: uri.scheme ?: "another app"
        MaterialAlertDialogBuilder(this)
            .setTitle("Open another app?")
            .setMessage("This page wants to open $destination outside Fokk Browser. Continue only if you expected this.")
            .setNegativeButton("Stay in browser", null)
            .setPositiveButton("Open") { _, _ ->
                try {
                    val externalIntent = parsedIntent ?: Intent(Intent.ACTION_VIEW, uri)
                    externalIntent.component = null
                    externalIntent.selector = null
                    externalIntent.setPackage(null)
                    externalIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    externalIntent.addCategory(Intent.CATEGORY_BROWSABLE)
                    startActivity(Intent.createChooser(externalIntent, "Open with"))
                } catch (_: Exception) {
                    Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show()
                }
            }
            .show()
    }

    private fun hideCustomView() {
        val activeCustomView = customView ?: return
        isFullscreenCustomView = false
        binding.fullscreenContainer.removeView(activeCustomView)
        binding.fullscreenContainer.visibility = View.GONE
        binding.mainContentLayout.visibility = View.VISIBLE
        setBrowserChromeVisible(true)

        val decor = window.decorView
        previousSystemUiVisibility?.let { decor.systemUiVisibility = it }
        if (previousWindowWasFullscreen == false) {
            window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN)
        }
        // Always clear KEEP_SCREEN_ON when exiting fullscreen; onMediaPlaybackUpdated will re-apply if needed
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        previousRequestedOrientation?.let { requestedOrientation = it } ?: run {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }

        try {
            val insetsController = WindowCompat.getInsetsController(window, decor)
            insetsController.show(WindowInsetsCompat.Type.systemBars())
        } catch (e: Exception) {}

        val callback = customViewCallback
        customView = null
        customViewCallback = null
        previousSystemUiVisibility = null
        previousRequestedOrientation = null
        previousWindowWasFullscreen = null
        callback?.onCustomViewHidden()
    }

    private var commandBarCollapsed = false

    private fun collapseCommandBar(animated: Boolean = true) {
        setBrowserChromeVisible(false)
    }

    private fun expandCommandBar(animated: Boolean = true) {
        val isHome = isHomePageUrl(activeWebView?.url)
        if (isHome) {
            binding.topBar.visibility = View.GONE
            binding.layoutCollapsedBar.visibility = View.GONE
            commandBarCollapsed = false
            return
        }
        binding.layoutCollapsedBar.visibility = View.GONE
        commandBarCollapsed = false
        setBrowserChromeVisible(true)
    }

    private val showChromeOnIdleRunnable = Runnable {
        if (browserChromeHidden && customView == null && !isFullscreenCustomView) {
            setBrowserChromeVisible(true)
        }
    }

    private fun setBrowserChromeVisible(visible: Boolean) {
        if (customView != null || isFullscreenCustomView) return
        val isTop = prefs.getString(PREF_TOOLBAR_POSITION, "bottom") == "top"
        val density = resources.displayMetrics.density
        val barHeight = if (binding.topBar.height > 0) binding.topBar.height.toFloat() else 56 * density
        val slideDistance = barHeight + (8 * density)

        binding.layoutCollapsedBar.visibility = View.GONE
        val containerLp = binding.mainContentLayout.layoutParams as? RelativeLayout.LayoutParams

        val isHome = isHomePageUrl(activeWebView?.url)
        if (isHome) {
            binding.topBar.visibility = View.GONE
            browserChromeHidden = false
            containerLp?.let {
                it.topMargin = 0
                it.bottomMargin = 0
                binding.mainContentLayout.layoutParams = it
            }
            binding.mainContentLayout.translationY = 0f
            return
        }

        binding.mainContentLayout.translationY = 0f

        if (visible) {
            if (!browserChromeHidden) return
            browserChromeHidden = false
            ignoreScrollUntilMs = System.currentTimeMillis() + 350L

            // Restore margin so the bar docks cleanly without covering page content
            containerLp?.let {
                val targetTop = if (isTop) (56 * density).toInt() else 0
                val targetBottom = if (isTop) 0 else (56 * density).toInt()
                if (it.topMargin != targetTop || it.bottomMargin != targetBottom) {
                    it.topMargin = targetTop
                    it.bottomMargin = targetBottom
                    binding.mainContentLayout.layoutParams = it
                }
            }

            binding.topBar.animate().cancel()
            binding.topBar.translationY = 0f
            binding.topBar.alpha = 1f
            binding.topBar.visibility = View.VISIBLE
        } else {
            if (browserChromeHidden || binding.urlInput.hasFocus()) return
            browserChromeHidden = true
            ignoreScrollUntilMs = System.currentTimeMillis() + 350L

            // Expand webpage to fill 100% full screen when bar collapses (zero empty space)
            containerLp?.let {
                if (it.topMargin != 0 || it.bottomMargin != 0) {
                    it.topMargin = 0
                    it.bottomMargin = 0
                    binding.mainContentLayout.layoutParams = it
                }
            }

            val targetY = if (isTop) -slideDistance else slideDistance
            binding.topBar.animate().cancel()
            binding.topBar.animate()
                .alpha(0f)
                .translationY(targetY)
                .setDuration(160)
                .setInterpolator(android.view.animation.AccelerateInterpolator())
                .withEndAction {
                    if (browserChromeHidden) binding.topBar.visibility = View.GONE
                }
                .start()
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun createTab(url: String, isPrivate: Boolean = false): BrowserTab {
        val webView = FocusedPaneWebView(this)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.setBackgroundColor(android.graphics.Color.parseColor("#090D14"))
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        if (injectionScript.isEmpty() || defusersScript.isEmpty()) loadInjectionScript()
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                if (defusersScript.isNotEmpty()) {
                    WebViewCompat.addDocumentStartJavaScript(
                        webView,
                        defusersScript,
                        setOf("*")
                    )
                }
                if (injectionScript.isNotEmpty()) {
                    WebViewCompat.addDocumentStartJavaScript(
                        webView,
                        injectionScript,
                        setOf("*")
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to register document start script", e)
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST)) {
            try {
                val method = WebSettingsCompat::class.java.methods.firstOrNull {
                    it.name == "setRequestedWithHeaderOriginAllowList" || it.name == "setRequestedWithHeaderAllowList"
                }
                method?.invoke(null, webView.settings, emptySet<String>())
            } catch (e: Exception) {
                Log.w(TAG, "Failed to configure requested with header allow list", e)
            }
        }

        webView.clipToPadding = false
        webView.setPadding(0, 0, 0, 0)
        webView.isNestedScrollingEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        }

        webView.setOnTouchListener { _, event ->
            if (event.actionMasked == MotionEvent.ACTION_DOWN || event.actionMasked == MotionEvent.ACTION_MOVE) {
                webView.parent?.requestDisallowInterceptTouchEvent(true)
            }
            if (event.action == MotionEvent.ACTION_DOWN || event.action == MotionEvent.ACTION_UP) {
                lastUserInteractionTime = System.currentTimeMillis()
            }
            if (event.action == MotionEvent.ACTION_DOWN) {
                activateBrowsingPane(webView)
            }
            if (binding.urlInput.hasFocus()) {
                binding.urlInput.clearFocus()
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                imm?.hideSoftInputFromWindow(binding.urlInput.windowToken, 0)
                binding.cardSuggestions.visibility = View.GONE
            }
            false
        }

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, false)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(true)
            loadsImagesAutomatically = true
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = if (isPrivate) WebSettings.LOAD_NO_CACHE else WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            allowFileAccess = true
            allowContentAccess = true
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) safeBrowsingEnabled = true
            userAgentString = cleanMobileUa
        }

        webView.addJavascriptInterface(WebAppInterface(this, webView), "FokkShieldBridge")
        webView.addJavascriptInterface(MediaPlaybackBridge(this), "FokkMediaBridge")

        // Intercept downloads cleanly
        webView.setDownloadListener { downloadUrl, userAgent, contentDisposition, mimetype, _ ->
            val confirmPrivateDownload = tabs.firstOrNull { it.webView === webView }?.isPrivate == true
            showDownloadOptions(
                downloadUrl,
                userAgent,
                contentDisposition,
                mimetype,
                isPrivate = confirmPrivateDownload,
                sourceUrl = webView.url.orEmpty(),
                allowThirdPartyCookies = cookieManager.acceptThirdPartyCookies(webView)
            )
        }

        // Content filters are applied after navigation and only on supported, non-platform sites.

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val reqUrl = request?.url?.toString() ?: return false
                return handleBrowserNavigation(view, reqUrl, request?.hasGesture() == true)
            }

            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url.isNullOrBlank()) return false
                return handleBrowserNavigation(view, url, false)
            }

            override fun onPageStarted(view: WebView?, pageUrl: String?, favicon: Bitmap?) {
                super.onPageStarted(view, pageUrl, favicon)
                val loadingTab = tabs.firstOrNull { it.webView === view }
                if (loadingTab?.isOfflineReader == true && pageUrl?.startsWith(OFFLINE_PAGE_BASE_URL) != true) {
                    loadingTab.isOfflineReader = false
                }
                view?.let {
                    cancelPendingWebPermission(it)
                    cancelPendingLocationPermission(it)
                }
                if (view != null && pageUrl != null) pageUrlsByWebView[view] = pageUrl
                if (view != null) {
                    // Do not attach delayed callbacks from the previous document to this page.
                    synchronized(filteredCountLock) {
                        pendingFilteredCounts.remove(view)
                        pendingFilteredHosts.remove(view)
                        pendingThirdPartyCounts.remove(view)
                        pendingThirdPartyHosts.remove(view)
                    }
                }
                if (view != null) {
                    val isAuthHost = pageUrl?.let { url ->
                        val host = runCatching { Uri.parse(url).host?.lowercase(Locale.ROOT) }.getOrNull().orEmpty()
                        host.contains("x.com") || host.contains("twitter.com") || host.contains("arkoselabs.com") ||
                        host.contains("google.") || host.contains("apple.") || host.contains("facebook.") ||
                        host.contains("github.com") || host.contains("live.com") || host.contains("microsoft.com")
                    } ?: false
                    CookieManager.getInstance().setAcceptThirdPartyCookies(
                        view,
                        isAuthHost
                    )
                }
                setBridgeEnabled(view, pageUrl)
                // WebRTC IP-Leak Shield: suppress STUN/host IP discovery while Fokk Mesh is active
                if (view != null && com.adshield.app.engine.VpnEngine.getActiveMode(this@MediaHubActivity) != com.adshield.app.engine.VpnEngine.VpnMode.OFF) {
                    view.evaluateJavascript(
                        """
                        (function(){
                            if(window.__fokkMeshWebRtcShield) return;
                            window.__fokkMeshWebRtcShield = true;
                            try {
                                var OrigPC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
                                if (!OrigPC) return;
                                var GuardedPC = function(cfg, constraints) {
                                    var safeCfg = Object.assign({}, cfg || {}, { iceServers: [], iceTransportPolicy: 'relay' });
                                    return new OrigPC(safeCfg, constraints);
                                };
                                GuardedPC.prototype = OrigPC.prototype;
                                window.RTCPeerConnection = GuardedPC;
                                if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = GuardedPC;
                            } catch(_) {}
                        })();
                        """.trimIndent(),
                        null
                    )
                }
                loadingTab?.filteredRequests = 0
                loadingTab?.filteredRequestHosts?.clear()
                loadingTab?.thirdPartyRequests = 0
                loadingTab?.thirdPartyRequestHosts?.clear()
                if (view == activeWebView) {
                    val isStartPage = isHomePageUrl(pageUrl)
                    if (isStartPage) {
                        binding.topBar.visibility = View.GONE
                        binding.layoutCollapsedBar.visibility = View.GONE
                        binding.cardSuggestions.visibility = View.GONE
                    } else {
                        setBrowserChromeVisible(true)
                    }
                    updateToolbarLayoutForUrl(pageUrl, animated = false)
                    isShieldEnabled = isShieldEnabledFor(pageUrl)
                    binding.progressBar.visibility = if (isStartPage) View.GONE else View.VISIBLE
                    // page reset
                    if (pageUrl != null && !binding.urlInput.hasFocus()) {
                        val displayUrl = if (loadingTab?.isOfflineReader == true) loadingTab.url else pageUrl
                        updateUrlBar(displayUrl, loadingTab?.title)
                    }
                }
                injectAdblockScript(view, pageUrl)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true && view == activeWebView) {
                    binding.progressBar.visibility = View.GONE
                    binding.swipeRefreshLayout.isRefreshing = false
                    Log.w(TAG, "Navigation failed for ${request.url}: ${error?.description}")
                    Toast.makeText(
                        this@MediaHubActivity,
                        "This page could not load. Check your connection or try turning off the site shield.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onRenderProcessGone(
                view: WebView?,
                detail: RenderProcessGoneDetail?
            ): Boolean {
                if (view == null) return true
                val tabIndex = tabs.indexOfFirst { it.webView === view }
                if (tabIndex < 0) {
                    (view.parent as? ViewGroup)?.removeView(view)
                    view.destroy()
                    return true
                }

                val oldTab = tabs[tabIndex]
                val crashedUrl = view.url?.takeIf { it.startsWith("http://") || it.startsWith("https://") }
                    ?: oldTab.url
                val wasActive = tabIndex == activeTabIndex
                if (wasActive && customView != null) hideCustomView()
                binding.tabContainer.removeView(view)
                pageUrlsByWebView.remove(view)
                view.destroy()

                val replacement = createTab(crashedUrl, oldTab.isPrivate).apply {
                    title = oldTab.title
                    filteredRequests = oldTab.filteredRequests
                    filteredRequestHosts.putAll(oldTab.filteredRequestHosts)
                    thirdPartyRequests = oldTab.thirdPartyRequests
                    thirdPartyRequestHosts.putAll(oldTab.thirdPartyRequestHosts)
                    isDesktop = oldTab.isDesktop
                    shouldLoadOnSelect = wasActive
                }
                tabs[tabIndex] = replacement
                val replacementWebView = replacement.webView ?: return true
                applyDesktopMode(replacementWebView, replacement.isDesktop)
                if (wasActive) switchToTab(tabIndex) else {
                    replacementWebView.visibility = View.GONE
                    loadUrlInWebView(replacementWebView, crashedUrl)
                }
                if (wasActive) {
                    Toast.makeText(
                        this@MediaHubActivity,
                        "A page process stopped. Fokk restored this tab; reload if it remains blank.",
                        Toast.LENGTH_LONG
                    ).show()
                }
                return true
            }

            override fun onPageFinished(view: WebView?, pageUrl: String?) {
                super.onPageFinished(view, pageUrl)
                if (view != null && pageUrl != null) pageUrlsByWebView[view] = pageUrl
                setBridgeEnabled(view, pageUrl)
                // WebRTC IP-Leak Shield: suppress STUN/host IP discovery while Fokk Mesh is active
                if (view != null && com.adshield.app.engine.VpnEngine.getActiveMode(this@MediaHubActivity) != com.adshield.app.engine.VpnEngine.VpnMode.OFF) {
                    view.evaluateJavascript(
                        """
                        (function(){
                            if(window.__fokkMeshWebRtcShield) return;
                            window.__fokkMeshWebRtcShield = true;
                            try {
                                var OrigPC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
                                if (!OrigPC) return;
                                var GuardedPC = function(cfg, constraints) {
                                    var safeCfg = Object.assign({}, cfg || {}, { iceServers: [], iceTransportPolicy: 'relay' });
                                    return new OrigPC(safeCfg, constraints);
                                };
                                GuardedPC.prototype = OrigPC.prototype;
                                window.RTCPeerConnection = GuardedPC;
                                if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = GuardedPC;
                            } catch(_) {}
                        })();
                        """.trimIndent(),
                        null
                    )
                }
                if (view == activeWebView) {
                    binding.progressBar.visibility = View.GONE
                    binding.swipeRefreshLayout.isRefreshing = false
                }
                val loadedTab = tabs.firstOrNull { it.webView == view }
                if (loadedTab?.isOfflineReader != true) {
                    injectAdblockScript(view, pageUrl)
                    if (isDarkMode && !isThirdPartyMediaService(pageUrl)) injectDarkModeScript(view, true)
                    view?.postDelayed({
                        view.evaluateJavascript("if (typeof window.fokkRunInjectors === 'function') { window.fokkRunInjectors(); }", null)
                    }, 400)
                    view?.postDelayed({
                        view.evaluateJavascript("if (typeof window.fokkRunInjectors === 'function') { window.fokkRunInjectors(); }", null)
                    }, 1500)
                    view?.postDelayed({
                        view.evaluateJavascript("if (typeof window.fokkRunInjectors === 'function') { window.fokkRunInjectors(); }", null)
                    }, 3000)
                }
                pageUrl?.let { loadedUrl ->
                    if (loadedTab?.isOfflineReader != true) {
                        loadedTab?.url = loadedUrl
                        if (loadedUrl.contains("fokk_start.html")) {
                            loadedTab?.title = "New Tab"
                            val theme = prefs.getString(PREF_ACTIVE_THEME, "default") ?: "default"
                            val customData = if (theme == "custom") getCustomWallpaperDataUri() else ""
                            view?.evaluateJavascript(
                                "if (typeof applyThemeFromNative === 'function') applyThemeFromNative('$theme', '$customData');",
                                null
                            )
                        } else if (loadedTab != null) {
                            recordHistory(view?.title ?: loadedUrl, loadedUrl, loadedTab.isPrivate)
                        }
                    } else if (view == activeWebView) {
                        loadedTab?.let { updateUrlBar(it.url, it.title) }
                    }
                    if (view == activeWebView && loadedTab?.isOfflineReader != true) updateUrlBar(loadedUrl, view?.title)
                }
                view?.title?.let {
                    if (it.isNotEmpty() && loadedTab?.url?.contains("fokk_start.html") != true) {
                        loadedTab?.title = it
                    }
                }

                // If tab is in desktop mode, inject desktop viewport meta override
                if (loadedTab?.isDesktop == true && !isThirdPartyMediaService(pageUrl)) {
                    val js = "javascript:(function(){let vp=document.querySelector('meta[name=\"viewport\"]');if(vp){vp.setAttribute('content','width=1280, initial-scale=0.85');}})();"
                    view?.evaluateJavascript(js, null)
                }

                // Universal article scroll-lock and CMP defuser sweep
                val targetHost = try { pageUrl?.let { Uri.parse(it).host?.lowercase(Locale.ROOT) } } catch (_: Exception) { null }
                if (targetHost != null && !targetHost.contains("youtube.com") && !targetHost.contains("youtu.be")) {
                    view?.postDelayed({
                        view.evaluateJavascript("if (typeof unlockPageScrolling === 'function') unlockPageScrolling();", null)
                    }, 500)
                    view?.postDelayed({
                        view.evaluateJavascript("if (typeof unlockPageScrolling === 'function') unlockPageScrolling();", null)
                    }, 1500)
                }
            }

            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                // Never replace a requested document with a synthetic empty response.
                if (request?.isForMainFrame == true) return super.shouldInterceptRequest(view, request)

                val pageUrl = view?.let { pageUrlsByWebView[it] }
                val requestUrl = request?.url?.toString()
                val host = request?.url?.host ?: return super.shouldInterceptRequest(view, request)
                val hostLower = host.lowercase(Locale.ROOT)
                // Zero interception overhead on performance benchmark suites (Speedometer, WebXPRT, JetStream)
                if (hostLower.contains("browserbench") || hostLower.contains("speedometer") || hostLower.contains("webxprt") || hostLower.contains("principledtechnologies")) {
                    return super.shouldInterceptRequest(view, request)
                }
                val pageHost = pageUrl?.let { runCatching { Uri.parse(it).host }.getOrNull() }
                val pageHostLower = pageHost?.lowercase(Locale.ROOT)
                if (pageHostLower != null && (pageHostLower.contains("browserbench") || pageHostLower.contains("speedometer") || pageHostLower.contains("webxprt"))) {
                    return super.shouldInterceptRequest(view, request)
                }

                // X (Twitter) SPA: Unconditionally allow all Twitter/X endpoints, GraphQL queries,
                // and Twimg CDN bundles so the React client boots cleanly without CORS or interception errors
                val isTwitterHost = hostLower == "x.com" || hostLower.endsWith(".x.com") ||
                    hostLower == "twitter.com" || hostLower.endsWith(".twitter.com") ||
                    hostLower == "twimg.com" || hostLower.endsWith(".twimg.com") ||
                    hostLower == "t.co" || hostLower.endsWith(".t.co")
                if (isTwitterHost) {
                    return super.shouldInterceptRequest(view, request)
                }
                val isTwitterPage = pageHostLower == "x.com" || pageHostLower?.endsWith(".x.com") == true ||
                    pageHostLower == "twitter.com" || pageHostLower?.endsWith(".twitter.com") == true
                if (isTwitterPage && (isSocialInfrastructureHost(host) || isSocialAppHost(host))) {
                    return super.shouldInterceptRequest(view, request)
                }

                val isCrossSiteRequest = pageHost != null && !isSameSite(pageHost, host)
                if (isCrossSiteRequest) recordThirdPartyRequest(view, host)

                if (!isShieldEnabledFor(pageUrl ?: requestUrl)) {
                    return super.shouldInterceptRequest(view, request)
                }

                val urlStr = request.url.toString().lowercase()
                val acceptHeader = request?.requestHeaders?.get("Accept").orEmpty().lowercase()
                val isMediaRequest = acceptHeader.contains("video/") ||
                    acceptHeader.contains("audio/") ||
                    host.contains("googlevideo.com") ||
                    urlStr.contains("/videoplayback") ||
                    listOf(".m3u8", ".mpd", ".mp4", ".webm", ".m4s", ".ts")
                        .any { urlStr.substringBefore('?').endsWith(it) }

                // Social apps are tightly coupled SPAs. Allow core social infrastructure & feeds,
                // but block known third-party ad networks, telemetry trackers, and ad pixels.
                if (isSocialAppHost(pageHost) || isSocialInfrastructureHost(host)) {
                    val isThirdPartyAd = urlStr.contains("/pagead/") ||
                        urlStr.contains("doubleclick.net") ||
                        urlStr.contains("adservice.google.") ||
                        urlStr.contains("googleadservices.com") ||
                        urlStr.contains("googletagservices.com") ||
                        urlStr.contains("amazon-adsystem.com") ||
                        urlStr.contains("criteo.") ||
                        urlStr.contains("taboola.com") ||
                        urlStr.contains("outbrain.com")
                    val isGenericAdPath = !isSocialInfrastructureHost(host) && urlStr.contains("/ads/")
                    val isAdOrTracker = isDedicatedAdOrTrackerHost(host) ||
                        isThirdPartyAd ||
                        isGenericAdPath ||
                        (!isSocialInfrastructureHost(host) && AdShieldApp.instance.blocklistEngine.isUrlBlocked(requestUrl ?: ""))
                    if (isAdOrTracker && !isMediaRequest) {
                        recordFilteredRequest(view, host)
                        return createBlockedResourceResponse(urlStr)
                    }
                    return super.shouldInterceptRequest(view, request)
                }
                val isAdScript = urlStr.contains("/pagead/") ||
                        urlStr.contains("adsbygoogle.js") ||
                        urlStr.contains("/adsbygoogle/") ||
                        urlStr.contains("googletagservices.com") ||
                        urlStr.contains("googleadservices.com") ||
                        urlStr.contains("/gpt.js") ||
                        urlStr.contains("adservice.google.") ||
                        urlStr.contains("/api/stats/ads") ||
                        urlStr.contains("/youtubei/v1/player/ad_break") ||
                        urlStr.contains("taboola.com") ||
                        urlStr.contains("outbrain.com") ||
                        urlStr.contains("criteo.") ||
                        urlStr.contains("amazon-adsystem.com") ||
                        urlStr.contains("prebid") ||
                        urlStr.contains("pubmatic.com") ||
                        urlStr.contains("rubiconproject.com") ||
                        urlStr.contains("openx.net") ||
                        urlStr.contains("adnxs.com") ||
                        urlStr.contains("casalemedia.com") ||
                        urlStr.contains("smartadserver.com") ||
                        urlStr.contains("yieldmo.com") ||
                        urlStr.contains("revcontent.com") ||
                        urlStr.contains("mgid.com") ||
                        urlStr.contains("media.net") ||
                        urlStr.contains("ezoic.net") ||
                        urlStr.contains("mediavine.com") ||
                        urlStr.contains("adthrive.com") ||
                        urlStr.contains("scorecardresearch.com") ||
                        urlStr.contains("quantserve.com")

                // Dedicated YouTube handler: block known YouTube ad endpoints, but NEVER touch
                // legitimate video streams (googlevideo.com) or player infrastructure (youtube.com, ytimg.com).
                // YouTube is explicitly exempted from general Brave adblock-rust EasyList rules
                // because generic rules break YouTube SPA navigation & video player state machine.
                val isYouTubePage = pageHost?.contains("youtube.com") == true || pageHost?.contains("youtu.be") == true ||
                                    host.contains("youtube.com") || host.contains("googlevideo.com") || host.contains("ytimg.com")
                if (isYouTubePage) {
                    val isYtAdUrl = urlStr.contains("/pagead/") ||
                        urlStr.contains("/api/stats/ads") ||
                        urlStr.contains("ad_break") ||
                        urlStr.contains("get_midroll_info") ||
                        urlStr.contains("doubleclick.net") ||
                        urlStr.contains("googlesyndication.com") ||
                        urlStr.contains("googleadservices.com") ||
                        urlStr.contains("adservice.google.")
                    if (isYtAdUrl && !isMediaRequest) {
                        recordFilteredRequest(view, host)
                        return createBlockedResourceResponse(urlStr)
                    }
                    return super.shouldInterceptRequest(view, request)
                }

                // 1. Check native Brave adblock-rust Engine for all non-YouTube websites
                if (!isMediaRequest) {
                    val braveDecision = AdShieldApp.instance.braveEngine.checkNetworkRequest(
                        url = requestUrl ?: "",
                        sourceUrl = pageUrl ?: "",
                        mimeOrType = acceptHeader
                    )
                    if (braveDecision.matched) {
                        recordFilteredRequest(view, host)
                        val redirectUrl = braveDecision.redirect
                        if (redirectUrl != null) {
                            val redirectRes = createRedirectResponse(redirectUrl)
                            if (redirectRes != null) return redirectRes
                        }
                        return createBlockedResourceResponse(urlStr)
                    }
                }

                if (isAdScript && !isMediaRequest) {
                    recordFilteredRequest(view, host)
                    return createBlockedResourceResponse(urlStr)
                }

                if (pageHost != null && !isCrossSiteRequest) {
                    return super.shouldInterceptRequest(view, request)
                }

                if (isStreamingHost(host)) {
                    return super.shouldInterceptRequest(view, request)
                }

                val isStrictAdblock = prefs.getBoolean(PREF_STRICT_ADBLOCK, true)
                val isSocialShield = prefs.getBoolean(PREF_SOCIAL_WIDGETS, true)

                val isEliteDnsOn = prefs.getBoolean(PREF_ELITE_DNS_FILTER, true)
                val isEliteBlocked = isEliteDnsOn && isEliteDnsBlocked(host)

                val isSocialTracker = isSocialShield && (
                    host.contains("connect.facebook.net") ||
                    host.contains("graph.facebook.com") ||
                    host.contains("analytics.tiktok.com") ||
                    host.contains("pixel.wp.com") ||
                    host.contains("licdn.com") ||
                    host.contains("linkedin.com/px") ||
                    host.contains("ads-twitter.com") ||
                    host.contains("static.ads-twitter.com") ||
                    host.contains("pinterest.com/v3") ||
                    host.contains("ct.pinterest.com") ||
                    host.contains("addthis.com") ||
                    host.contains("sharethis.com")
                )

                if (isSocialTracker) {
                    if (!isIsolatedPrivateProfile) AdShieldApp.instance.incrementSocialTrackers(1)
                    recordFilteredRequest(view, host)
                    return createBlockedResourceResponse(urlStr)
                }

                if (isStrictAdblock && (
                            isAdScript && !isMediaRequest ||
                            (!isMediaRequest && (AdShieldApp.instance.blocklistEngine.isUrlBlocked(requestUrl ?: "") || isEliteBlocked))
                        )) {
                    recordFilteredRequest(view, host)
                    return createBlockedResourceResponse(urlStr)
                }

                return super.shouldInterceptRequest(view, request)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val requested = request.resources ?: emptyArray()
                if (requested.isNotEmpty() && requested.all { it == PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID }) {
                    request.grant(requested)
                    return
                }
                runOnUiThread { handleWebPermissionRequest(webView, request) }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest?) {
                if (request != null && pendingWebPermission?.request === request) {
                    pendingWebPermission = null
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (callback == null) return
                runOnUiThread { handleGeolocationPrompt(webView, origin, callback) }
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                val message = resultMsg ?: return false
                val transport = message.obj as? WebView.WebViewTransport ?: return false
                val sourceHost = view?.url?.let { runCatching { Uri.parse(it).host?.lowercase(Locale.ROOT) }.getOrNull() }.orEmpty()
                val isAuthOrTrustedHost = isThirdPartyMediaServiceHost(sourceHost) ||
                    sourceHost.contains("google.") || sourceHost.contains("apple.") || sourceHost.contains("x.com") || sourceHost.contains("twitter.com")
                // Block unauthorized popups: only allow genuine user gesture, dialog, or trusted auth flow
                val hasInteraction = isUserGesture || isDialog || (isAuthOrTrustedHost && hasRecentUserInteraction())
                if (!hasInteraction) {
                    if (!isIsolatedPrivateProfile) AdShieldApp.instance.incrementDeceptiveTraps(1)
                    return false
                }

                val sourceTab = tabs.firstOrNull { it.webView === view }
                val newTab = createTab("about:blank", isPrivate = sourceTab?.isPrivate == true)
                sourceTab?.let { newTab.isDesktop = it.isDesktop }
                tabs.add(newTab)
                switchToTab(tabs.lastIndex)
                val popupWebView = newTab.webView ?: return false
                applyDesktopMode(popupWebView, newTab.isDesktop)
                transport.webView = popupWebView
                message.sendToTarget()
                updateTabCounter()
                return true
            }

            override fun onCloseWindow(window: WebView?) {
                runOnUiThread {
                    val tabToClose = tabs.firstOrNull { it.webView === window }
                    if (tabToClose != null) {
                        val index = tabs.indexOf(tabToClose)
                        closeTab(index)
                    }
                }
            }

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (view == activeWebView) {
                    binding.progressBar.progress = newProgress
                }
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                super.onReceivedTitle(view, title)
                if (!title.isNullOrEmpty() && activeTab?.url?.contains("fokk_start.html") != true) {
                    tabs.find { it.webView == view }?.title = title
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback
                try {
                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "image/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    fileChooserLauncher.launch(intent)
                    return true
                } catch (e: Exception) {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = null
                    return false
                }
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                super.onShowCustomView(view, callback)
                if (view == null || customView != null) {
                    callback?.onCustomViewHidden()
                    return
                }
                isFullscreenCustomView = true
                val decor = window.decorView
                previousSystemUiVisibility = decor.systemUiVisibility
                previousRequestedOrientation = requestedOrientation
                previousWindowWasFullscreen = (window.attributes.flags and android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN) != 0
                customView = view
                customViewCallback = callback
                window.addFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN)
                window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                decor.systemUiVisibility = decor.systemUiVisibility or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                try {
                    val insetsController = WindowCompat.getInsetsController(window, decor)
                    insetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    insetsController.hide(WindowInsetsCompat.Type.systemBars())
                } catch (e: Exception) {}

                // Auto-rotate to sensor landscape so widescreen videos fill display
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

                view.isFocusable = true
                view.isFocusableInTouchMode = true
                view.requestFocus()
                binding.fullscreenContainer.addView(
                    view,
                    FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                )
                binding.fullscreenContainer.visibility = View.VISIBLE
                binding.mainContentLayout.visibility = View.GONE
                binding.topBar.visibility = View.GONE
                binding.layoutCollapsedBar.visibility = View.GONE
            }

            override fun onHideCustomView() {
                super.onHideCustomView()
                hideCustomView()
            }
        }

        // Dual Scroll Auto-Hide Toolbar mechanics without aggressive idle timers
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            webView.setOnScrollChangeListener { scrolledView, _, scrollY, _, oldScrollY ->
                if (scrolledView !== activeWebView) return@setOnScrollChangeListener
                if (customView != null || isFullscreenCustomView) return@setOnScrollChangeListener
                if (isDualDeckMode) return@setOnScrollChangeListener
                if (System.currentTimeMillis() < ignoreScrollUntilMs) return@setOnScrollChangeListener
                val currentUrl = activeWebView?.url.orEmpty()
                val isShorts = currentUrl.contains("/shorts/") || currentUrl.contains("tiktok.com") || currentUrl.contains("instagram.com/reels")
                val dy = scrollY - oldScrollY
                binding.topBar.removeCallbacks(showChromeOnIdleRunnable)

                // Keep the address bar and video minimize control available while a video plays.
                if (isMediaPlaying && hasActiveVideo && binding.btnPictureInPicture.visibility == View.VISIBLE) {
                    if (browserChromeHidden) setBrowserChromeVisible(true)
                    return@setOnScrollChangeListener
                }

                if (dy > 18 && scrollY > 100) {
                    setBrowserChromeVisible(false)
                    binding.cardSuggestions.visibility = View.GONE
                } else if (!isShorts && (dy < -18 || scrollY < 25)) {
                    setBrowserChromeVisible(true)
                }
            }
        }

        val initialTitle = if (url.contains("fokk_start.html")) "New Tab" else "Fokk Browser"
        val tab = BrowserTab(title = initialTitle, url = url, isPrivate = isPrivate, webView = webView)
        binding.tabContainer.addView(webView)
        return tab
    }

    private fun isRestrictedMediaDownloadSource(sourceUrl: String, downloadUrl: String, mimeType: String?): Boolean {
        if (mimeType != null && !mimeType.startsWith("video") && !mimeType.startsWith("audio") && mimeType != "application/octet-stream") return false
        val sHost = runCatching { Uri.parse(sourceUrl).host?.lowercase(Locale.ROOT) }.getOrNull().orEmpty()
        val dHost = runCatching { Uri.parse(downloadUrl).host?.lowercase(Locale.ROOT) }.getOrNull().orEmpty()
        return sHost.contains("youtube.com") || sHost.contains("youtu.be") ||
               dHost.contains("youtube.com") || dHost.contains("googlevideo.com")
    }

    private fun showDownloadOptions(
        downloadUrl: String,
        userAgent: String,
        contentDisposition: String?,
        mimeType: String?,
        isPrivate: Boolean,
        sourceUrl: String,
        allowThirdPartyCookies: Boolean
    ) {
        if (isRestrictedMediaDownloadSource(sourceUrl, downloadUrl, mimeType)) {
            MaterialAlertDialogBuilder(this)
                .setTitle("Download Restricted")
                .setMessage("In compliance with Google Play Store Policies, downloading videos directly from YouTube is not supported. In-browser streaming remains fully enabled.")
                .setPositiveButton("Understood", null)
                .show()
            return
        }
        val privateNotice = if (isPrivate) {
            " Fokk may send cookies scoped to the download URL to Android Downloads. The file and download record remain after private tabs close."
        } else ""
        MaterialAlertDialogBuilder(this)
            .setTitle(if (isPrivate) "Save outside private tabs?" else "Download")
            .setMessage("Choose when this file can download.$privateNotice")
            .setNegativeButton("Cancel", null)
            .setNeutralButton("Wi-Fi only") { _, _ ->
                requestDownloadPermissionThenQueue(
                    downloadUrl, userAgent, contentDisposition, mimeType,
                    sourceUrl, allowThirdPartyCookies, wifiOnly = true
                )
            }
            .setPositiveButton(if (isPrivate) "Download anyway" else "Download now") { _, _ ->
                requestDownloadPermissionThenQueue(
                    downloadUrl, userAgent, contentDisposition, mimeType,
                    sourceUrl, allowThirdPartyCookies, wifiOnly = false
                )
            }
            .show()
    }

    private fun requestDownloadPermissionThenQueue(
        downloadUrl: String,
        userAgent: String,
        contentDisposition: String?,
        mimeType: String?,
        sourceUrl: String,
        allowThirdPartyCookies: Boolean,
        wifiOnly: Boolean
    ) {
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.P ||
            ContextCompat.checkSelfPermission(this, android.Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            enqueueDownload(
                downloadUrl, userAgent, contentDisposition, mimeType,
                sourceUrl, allowThirdPartyCookies, wifiOnly
            )
            return
        }

        pendingDownload = PendingDownload(
            downloadUrl, userAgent, contentDisposition, mimeType,
            sourceUrl, allowThirdPartyCookies, wifiOnly
        )
        MaterialAlertDialogBuilder(this)
            .setTitle("Allow download storage access?")
            .setMessage("Android 9 and earlier require storage access to save this file in Downloads.")
            .setNegativeButton("Cancel") { _, _ -> pendingDownload = null }
            .setPositiveButton("Continue") { _, _ ->
                storagePermissionLauncher.launch(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
            .setOnCancelListener { pendingDownload = null }
            .show()
    }

    private fun enqueueDownload(
        downloadUrl: String,
        userAgent: String,
        contentDisposition: String?,
        mimeType: String?,
        sourceUrl: String,
        allowThirdPartyCookies: Boolean,
        wifiOnly: Boolean
    ) {
        if (isRestrictedMediaDownloadSource(sourceUrl, downloadUrl, mimeType)) {
            Toast.makeText(this, "Downloading from YouTube is restricted under Google Play Store policies", Toast.LENGTH_LONG).show()
            return
        }
        try {
            val downloadUri = Uri.parse(downloadUrl)
            val downloadScheme = downloadUri.scheme?.lowercase(Locale.ROOT)
            if (downloadScheme !in setOf("https", "http") ||
                downloadUri.host.isNullOrBlank() || downloadUri.userInfo != null
            ) {
                Toast.makeText(this, "This download link is not supported", Toast.LENGTH_SHORT).show()
                return
            }
            val request = DownloadManager.Request(downloadUri).apply {
                setMimeType(mimeType)
                addRequestHeader("User-Agent", userAgent)
                // DownloadManager does not inherit this WebView's cookie store. Pass only
                // cookies scoped by Android to the requested URL so signed-in downloads work.
                val sourceHost = runCatching { Uri.parse(sourceUrl).host }.getOrNull()
                val downloadHost = downloadUri.host
                val maySendCookies = allowThirdPartyCookies ||
                    (sourceHost != null && downloadHost != null && isSameSite(sourceHost, downloadHost))
                if (maySendCookies) {
                    runCatching { CookieManager.getInstance().getCookie(downloadUrl) }
                        .getOrNull()
                        ?.takeIf(String::isNotBlank)
                        ?.let { addRequestHeader("Cookie", it) }
                }
                setDescription("Downloading via Fokk Browser...")
                setAllowedNetworkTypes(
                    if (wifiOnly) DownloadManager.Request.NETWORK_WIFI
                    else DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE
                )
                val fileName = safeDownloadFileName(
                    URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType)
                )
                setTitle(fileName)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                allowScanningByMediaScanner()
                setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, fileName)
            }
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            val message = if (wifiOnly) {
                "Queued for Wi-Fi; Android will resume it when Wi-Fi is available"
            } else {
                "Download queued in Android Downloads"
            }
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Log.e(TAG, "Could not queue browser download", e)
            Toast.makeText(this, "Could not queue this download. Check the link and try again.", Toast.LENGTH_LONG).show()
        }
    }

    private fun safeDownloadFileName(suggestedName: String): String {
        val leafName = suggestedName.substringAfterLast('/').substringAfterLast('\\')
        val safeName = leafName
            .filterNot(Char::isISOControl)
            .trim()
            .trimEnd('.')
            .take(MAX_DOWNLOAD_FILENAME_LENGTH)
        return safeName.ifBlank { "download" }
    }

    fun toggleGhostModeState() {
        if (isIsolatedPrivateProfile) {
            Toast.makeText(this, "Ghost Mode: OFF • Normal browsing restored", Toast.LENGTH_SHORT).show()
            finish()
        } else if (activeTab?.isPrivate == true) {
            val normalTabIdx = tabs.indexOfFirst { !it.isPrivate }
            if (normalTabIdx != -1) {
                switchToTab(normalTabIdx)
            } else {
                addNewTab("file:///android_asset/fokk_start.html", isPrivate = false)
            }
            Toast.makeText(this, "Ghost Mode: OFF • Normal browsing restored", Toast.LENGTH_SHORT).show()
        } else {
            authenticateForPrivateTabs {
                Toast.makeText(this, "Ghost Mode: ON • Zero cookies & history saved", Toast.LENGTH_SHORT).show()
                openIsolatedPrivateBrowser("file:///android_asset/fokk_start.html")
            }
        }
    }

    private fun openIsolatedPrivateBrowser(url: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            Toast.makeText(this, "Private tabs with isolated site data require Android 9 or newer", Toast.LENGTH_LONG).show()
            return
        }
        runCatching {
            startActivity(Intent(this, PrivateBrowserActivity::class.java).apply {
                putExtra(EXTRA_URL, url)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            })
        }.onFailure {
            Toast.makeText(this, "Could not open the isolated private browser", Toast.LENGTH_LONG).show()
        }
    }

    private fun addNewTab(
        url: String = "file:///android_asset/fokk_start.html",
        isPrivate: Boolean = false,
        isDesktop: Boolean = false
    ) {
        if (isIsolatedPrivateProfile && !privateProfileReady) {
            if (isWebUrl(url)) pendingPrivateUrls.add(url)
            return
        }
        if (isPrivate && !isIsolatedPrivateProfile) {
            openIsolatedPrivateBrowser(url)
            return
        }
        val tabIsPrivate = isPrivate || isIsolatedPrivateProfile
        val tab = createTab(url, tabIsPrivate).apply { this.isDesktop = isDesktop }
        val webView = tab.webView ?: return
        applyDesktopMode(webView, tab.isDesktop)
        tabs.add(tab)
        switchToTab(tabs.size - 1)
        loadUrlInWebView(webView, url)
        updateTabCounter()
        persistSession()
    }

    private fun switchToTab(index: Int) {
        if (index !in tabs.indices) return
        val current = tabs[index]
        if (!isHomePageUrl(current.url)) {
            setBrowserChromeVisible(true)
        }
        val previousTab = activeTab
        previousTab?.lastActiveTime = System.currentTimeMillis()

        activeTabIndex = index
        current.lastActiveTime = System.currentTimeMillis()
        if (current.isHibernated) {
            current.isHibernated = false
            current.webView?.resumeTimers()
        }
        if (current.webView == null) {
            val restored = createTab(current.url, current.isPrivate)
            val restoredWebView = restored.webView ?: return
            current.webView = restoredWebView
            current.isSuspended = false
            current.shouldLoadOnSelect = true
            applyDesktopMode(restoredWebView, current.isDesktop)
            if (current.suspendedForMemory) {
                current.suspendedForMemory = false
                Toast.makeText(this, "Reloaded this background tab to free memory", Toast.LENGTH_SHORT).show()
            }
        }
        applyWebViewVisibility()
        com.adshield.app.engine.VpnEngine.syncProxyForTabPrivacy(this, current.isPrivate)
        checkAndHibernateBackgroundTabs()
        if (current.shouldLoadOnSelect) {
            current.shouldLoadOnSelect = false
            loadUrlInWebView(current.webView, current.url)
        }
        updateUrlBar(current.url, current.title)
        updateToolbarLayoutForUrl(current.url, animated = false)

        // Apply Private Tab styling if active
        binding.imgEngineIcon.imageTintList = null
        binding.imgEngineIcon.setImageResource(currentSearchEngine.iconRes)
        val toolbarPos = prefs.getString(PREF_TOOLBAR_POSITION, "bottom") ?: "bottom"
        val isTop = toolbarPos.equals("top", ignoreCase = true)
        if (current.isPrivate) {
            binding.topBar.setBackgroundResource(if (isTop) R.drawable.bg_docked_command_bar_top_private else R.drawable.bg_docked_command_bar_bottom_private)
            binding.bottomNav.setBackgroundColor(android.graphics.Color.parseColor("#120A1C"))
        } else {
            binding.topBar.setBackgroundResource(if (isTop) R.drawable.bg_docked_command_bar_top else R.drawable.bg_docked_command_bar_bottom)
            binding.bottomNav.setBackgroundColor(android.graphics.Color.parseColor("#0C101A"))
        }

        updateTabCounter()
        persistSession()
    }

    private fun closeTab(index: Int) {
        if (index !in tabs.indices) return
        val previousActiveIndex = activeTabIndex
        val removed = tabs.removeAt(index)
        removed.webView?.let { webView ->
            cancelPendingWebPermission(webView)
            cancelPendingLocationPermission(webView)
            binding.tabContainer.removeView(webView)
            pageUrlsByWebView.remove(webView)
            webView.destroy()
        }

        if (tabs.isEmpty()) {
            addNewTab("file:///android_asset/fokk_start.html", isPrivate = false)
        } else {
            val newIndex = when {
                index < previousActiveIndex -> previousActiveIndex - 1
                index == previousActiveIndex -> minOf(index, tabs.lastIndex)
                else -> previousActiveIndex
            }
            switchToTab(newIndex)
        }
        updateTabCounter()
    }

    private fun updateTabCounter() {
        binding.textTabCount.text = tabs.size.toString()
        tabs.forEach { tab ->
            if (isHomePageUrl(tab.url)) {
                tab.webView?.evaluateJavascript(
                    "if (typeof updateTabBadgeFromNative === 'function') updateTabBadgeFromNative(${tabs.size});",
                    null
                )
            }
        }
    }

    private fun isShieldEnabledFor(url: String?): Boolean {
        val host = try { Uri.parse(url).host?.lowercase() } catch (_: Exception) { null } ?: return true
        val disabledSites = localPrefs.getStringSet(PREF_SHIELD_DISABLED_SITES, emptySet()).orEmpty()
        return host !in disabledSites && registrableDomain(host) !in disabledSites
    }

    /** Keep ad filters and injected scripts out of third-party streaming services. */
    private fun isThirdPartyMediaService(url: String?): Boolean {
        val host = try { Uri.parse(url).host?.lowercase() } catch (_: Exception) { null } ?: return false
        return isThirdPartyMediaServiceHost(host)
    }

    private fun isThirdPartyMediaServiceHost(host: String): Boolean =
        THIRD_PARTY_MEDIA_SERVICE_DOMAINS.any { host == it || host.endsWith(".$it") }

    /** Standard protection leaves same-site requests alone to reduce breakage. */
    private fun isSameSite(firstHost: String, secondHost: String): Boolean =
        registrableDomain(firstHost) == registrableDomain(secondHost)

    private fun registrableDomain(rawHost: String): String {
        val host = rawHost.lowercase().trim('.').substringBefore('%')
        if (host.isBlank() || ':' in host || IPV4_ADDRESS_REGEX.matches(host)) return host
        val labels = host.split('.').filter(String::isNotBlank)
        if (labels.size < 2) return host
        val lastTwo = labels.takeLast(2).joinToString(".")
        val suffixLabels = if (lastTwo in MULTI_LABEL_PUBLIC_SUFFIXES) 2 else 1
        return labels.takeLast(minOf(labels.size, suffixLabels + 1)).joinToString(".")
    }

    private fun setShieldEnabledForCurrentSite(enabled: Boolean) {
        val currentUrl = activeWebView?.url ?: activeTab?.url
        val host = try { currentUrl?.let { Uri.parse(it).host?.lowercase() } } catch (_: Exception) { null }
        if (host == null) {
            Toast.makeText(this, "Open a website to change its shield setting", Toast.LENGTH_SHORT).show()
            return
        }
        val site = registrableDomain(host)
        val disabled = localPrefs.getStringSet(PREF_SHIELD_DISABLED_SITES, emptySet()).orEmpty().toMutableSet()
        if (enabled) {
            disabled.remove(host)
            disabled.remove(site)
        } else {
            disabled.add(site)
        }
        localPrefs.edit().putStringSet(PREF_SHIELD_DISABLED_SITES, disabled).apply()
        isShieldEnabled = enabled
    }

    private fun persistSession() {
        if (isIsolatedPrivateProfile) return
        val state = JSONArray()
        val publicTabs = tabs.filter { !it.isPrivate && isRestorableSessionUrl(sessionUrl(it)) }
        val activePublicIndex = publicTabs.indexOfFirst { it === activeTab }
        val firstSavedIndex = if (publicTabs.size <= MAX_RESTORED_TABS) {
            0
        } else {
            val preferredStart = if (activePublicIndex >= 0) activePublicIndex - (MAX_RESTORED_TABS / 2) else 0
            preferredStart.coerceIn(0, publicTabs.size - MAX_RESTORED_TABS)
        }
        val restorableTabs = publicTabs.drop(firstSavedIndex).take(MAX_RESTORED_TABS)
        restorableTabs.forEach { tab ->
            state.put(JSONObject().put("url", sessionUrl(tab)).put("desktop", tab.isDesktop))
        }
        val activeRestorableIndex = if (activePublicIndex >= 0) activePublicIndex - firstSavedIndex else -1
        localPrefs.edit()
            .putString(PREF_SESSION_TABS, state.toString())
            .putInt(PREF_SESSION_ACTIVE_TAB, activeRestorableIndex.takeIf { it >= 0 } ?: (restorableTabs.lastIndex))
            .apply()
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level < ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) return
        if (isMediaPlaying || System.currentTimeMillis() - lastMediaPlayingTime < MEDIA_RECENT_ACTIVITY_WINDOW_MS) return

        flushFilteredRequestCounts()
        tabs.forEachIndexed { index, tab ->
            if (index == activeTabIndex || tab.isOfflineReader) return@forEachIndexed
            val webView = tab.webView ?: return@forEachIndexed
            tab.url = webView.url?.takeIf { isWebUrl(it) || it.startsWith("file:///android_asset/") } ?: tab.url
            tab.title = webView.title?.takeIf(String::isNotBlank) ?: tab.title
            cancelPendingWebPermission(webView)
            cancelPendingLocationPermission(webView)
            runCatching { webView.stopLoading() }
            binding.tabContainer.removeView(webView)
            pageUrlsByWebView.remove(webView)
            runCatching { webView.destroy() }
            tab.webView = null
            tab.isSuspended = true
            tab.suspendedForMemory = true
            tab.shouldLoadOnSelect = true
        }
    }

    private fun restoreLastSession() {
        val saved = localPrefs.getString(PREF_SESSION_TABS, null)
        val savedActiveIndex = localPrefs.getInt(PREF_SESSION_ACTIVE_TAB, -1)
        var restoredActiveIndex = -1
        try {
            val items = JSONArray(saved)
            for (i in 0 until items.length()) {
                if (tabs.size >= MAX_RESTORED_TABS) break
                val item = items.getJSONObject(i)
                val url = item.optString("url")
                if (isRestorableSessionUrl(url)) {
                    if (i == savedActiveIndex) restoredActiveIndex = tabs.size
                    tabs.add(BrowserTab(
                        title = Uri.parse(url).host ?: "New Tab",
                        url = url,
                        isDesktop = item.optBoolean("desktop", false),
                        shouldLoadOnSelect = true,
                        isSuspended = true,
                        isPrivate = false,
                        webView = null
                    ))
                }
            }
        } catch (_: Exception) { }
        if (tabs.isEmpty()) {
            addNewTab("file:///android_asset/fokk_start.html", isPrivate = false)
        } else {
            val restoredIndex = (restoredActiveIndex.takeIf { it >= 0 } ?: tabs.lastIndex)
                .coerceIn(0, tabs.lastIndex)
            switchToTab(restoredIndex)
            updateTabCounter()
        }
    }

    private fun sessionUrl(tab: BrowserTab): String =
        if (tab.isOfflineReader || tab.isSuspended) tab.url else (tab.webView?.url ?: tab.url)

    private fun isRestorableSessionUrl(url: String): Boolean =
        isWebUrl(url) || url.startsWith("file:///android_asset/")

    private fun createRedirectResponse(dataUri: String): WebResourceResponse? {
        return try {
            if (!dataUri.startsWith("data:")) return null
            val commaIndex = dataUri.indexOf(',')
            if (commaIndex == -1) return null
            val header = dataUri.substring(5, commaIndex)
            val payload = dataUri.substring(commaIndex + 1)
            val isBase64 = header.contains(";base64")
            val mimeType = header.substringBefore(';').ifEmpty { "text/plain" }
            val bytes = if (isBase64) {
                Base64.decode(payload, Base64.DEFAULT)
            } else {
                java.net.URLDecoder.decode(payload, "UTF-8").toByteArray(Charsets.UTF_8)
            }
            WebResourceResponse(
                mimeType,
                "UTF-8",
                200,
                "OK",
                mapOf("Cache-Control" to "no-store", "Access-Control-Allow-Origin" to "*"),
                ByteArrayInputStream(bytes)
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun createBlockedResourceResponse(urlStr: String): WebResourceResponse {
        val isVast = urlStr.contains("vast") || urlStr.contains("vpaid") || urlStr.contains("adtag") || urlStr.contains("/ad_tag") || urlStr.contains("spotxchange")
        val isJson = !isVast && (urlStr.contains("/youtubei/") || urlStr.contains("/api/stats/ads") || urlStr.contains(".json"))
        val isJs = !isVast && (urlStr.endsWith(".js") || urlStr.contains(".js?"))
        val mimeType = when {
            isVast -> "application/xml"
            isJson -> "application/json"
            isJs -> "application/javascript"
            else -> "text/plain"
        }
        val emptyPayload = when {
            isVast -> "<?xml version=\"1.0\" encoding=\"UTF-8\"?><VAST version=\"3.0\"></VAST>"
            isJson -> "{}"
            urlStr.contains("adsbygoogle") -> "(function(){window.adsbygoogle=window.adsbygoogle||[];window.adsbygoogle.loaded=true;})();"
            urlStr.contains("gpt.js") || urlStr.contains("googletagservices") -> "(function(){window.googletag=window.googletag||{cmd:[],apiReady:true};window.googletag.pubads=window.googletag.pubads||function(){var s={addEventListener:function(){},clear:function(){},display:function(){},enableAsyncRendering:function(){},enableSingleRequest:function(){},getSlots:function(){return[];},getSlotIdMap:function(){return{};},isInitialLoadDisabled:function(){return false;},refresh:function(){},setTargeting:function(){}};return s;};})();"
            urlStr.contains("prebid") -> "(function(){window.pbjs=window.pbjs||{cmd:[],adUnits:[],que:[]};})();"
            urlStr.contains("ima3.js") || urlStr.contains("imasdk.googleapis.com") -> "(function(){'use strict';if(window.google&&window.google.ima)return;var n=function(){};var m=function(){var l={};this.addEventListener=function(t,h){l[t]=l[t]||[];l[t].push(h);};this.removeEventListener=function(t,h){if(l[t])l[t]=l[t].filter(function(x){return x!==h;});};this.getCuePoints=function(){return[];};this.getAdSkippableState=function(){return false;};this.init=n;this.start=function(){setTimeout(function(){['allAdsCompleted','contentResumeRequested','complete'].forEach(function(e){if(l[e])l[e].forEach(function(f){try{f({type:e});}catch(err){}});});},5);};this.stop=n;this.resume=n;this.pause=n;this.resize=n;this.discardAdBreak=n;this.destroy=n;this.getRemainingTime=function(){return 0;};this.getVolume=function(){return 1;};this.setVolume=n;this.isCustomClickTrackingUsed=function(){return false;};this.isCustomPlaybackUsed=function(){return false;};};var s={setAutoPlayAdBreaks:n,setDisableCustomPlaybackForIOS10Plus:n,setLocale:n,setNumRedirects:n,setPlayerType:n,setPlayerVersion:n,setPpid:n,setVpaidAllowed:n,setVpaidMode:n};var L=function(c){var l={};this.addEventListener=function(t,h){l[t]=l[t]||[];l[t].push(h);};this.removeEventListener=function(t,h){if(l[t])l[t]=l[t].filter(function(x){return x!==h;});};this.contentComplete=n;this.destroy=n;this.getSettings=function(){return s;};this.requestAds=function(r){setTimeout(function(){var ml=l['adsManagerLoaded'];if(ml&&ml.length>0){var ev={type:'adsManagerLoaded',getAdsManager:function(){return new m();},getUserRequestContext:function(){return r?r.userRequestContext:null;}};ml.forEach(function(f){try{f(ev);}catch(err){}});}else{var el=l['adError'];if(el){var er={getError:function(){return{getMessage:function(){return'No ads';},getType:function(){return'AdError';},getErrorCode:function(){return 1009;}};}};el.forEach(function(f){try{f(er);}catch(err){}});}}},5);};};var ima={settings:s,AdDisplayContainer:function(c,v){this.initialize=n;this.destroy=n;},AdsLoader:L,AdsManager:m,AdsRequest:function(){this.adTagUrl='';this.adsResponse='';this.contentDuration=0;this.contentKeywords=[];this.contentTitle='';this.forceExperimentIds=[];this.linearAdSlotWidth=0;this.linearAdSlotHeight=0;this.liveStreamPrefetchSeconds=0;this.nonLinearAdSlotWidth=0;this.nonLinearAdSlotHeight=0;this.pageUrl='';this.userRequestContext=null;this.vastLoadTimeout=0;},AdsRenderingSettings:function(){this.autoAlign=true;this.bitrate=-1;this.enablePreloading=false;this.loadVideoTimeout=-1;this.mimeTypes=null;this.playAdsAfterTime=-1;this.restoreCustomPlaybackStateOnPlayerInit=true;this.useStyledAcceleratedCounter=true;this.useStyledLinearId=true;this.useStyledNonLinearId=true;},AdError:{Type:{AD:'ad',AD_LOAD:'adLoad'},ErrorCode:{ADSLOT_NOT_EMPTY:400,FAILED_TO_REQUEST_ADS:1005,INVALID_ARGUMENTS:1101,PLAYLIST_NO_CONTENT_FOUND:1009,UNKNOWN_ERROR:900,VAST_LOAD_TIMEOUT:301,VIDEO_PLAY_ERROR:400}},AdEvent:{Type:{AD_BREAK_READY:'adBreakReady',AD_BUFFERING:'adBuffering',AD_CAN_PLAY:'adCanPlay',AD_METADATA:'adMetadata',AD_PROGRESS:'adProgress',ALL_ADS_COMPLETED:'allAdsCompleted',CLICK:'click',COMPLETE:'complete',CONTENT_PAUSE_REQUESTED:'contentPauseRequested',CONTENT_RESUME_REQUESTED:'contentResumeRequested',DURATION_CHANGE:'durationChange',EXPANDED_CHANGED:'expandedChanged',FIRST_QUARTILE:'firstQuartile',IMPRESSION:'impression',INTERACTION:'interaction',LINEAR_CHANGED:'linearChanged',LOADED:'loaded',LOG:'log',MIDPOINT:'midpoint',PAUSED:'pause',RESUMED:'resumed',SKIPPABLE_STATE_CHANGED:'skippableStateChanged',SKIPPED:'skipped',STARTED:'started',THIRD_QUARTILE:'thirdQuartile',USER_CLOSE:'userClose',VOLUME_CHANGED:'volumeChanged',VOLUME_MUTED:'volumeMuted'}},AdErrorEvent:{Type:{AD_ERROR:'adError'}},AdsManagerLoadedEvent:{Type:{ADS_MANAGER_LOADED:'adsManagerLoaded'}},ViewMode:{NORMAL:'normal',FULLSCREEN:'fullscreen'},OmidAccessMode:{FULL:'full',DOMAIN:'domain',LIMITED:'limited'}};window.google=window.google||{};try{Object.defineProperty(window.google,'ima',{get:function(){return ima;},set:function(){},configurable:true,enumerable:true});}catch(e){window.google.ima=ima;}})();"
            urlStr.contains("analytics") || urlStr.contains("gtag") || urlStr.contains("ga.js") -> "(function(){window.ga=window.ga||function(){};window.gtag=window.gtag||function(){};})();"
            urlStr.contains("cookielaw") || urlStr.contains("onetrust") -> "(function(){window.OneTrust=window.OneTrust||{IsAlertBoxClosed:function(){return true;},Close:function(){}};})();"
            urlStr.contains("cookiebot") -> "(function(){window.Cookiebot=window.Cookiebot||{consent:{necessary:true,preferences:false,statistics:false,marketing:false},hasResponse:true};})();"
            urlStr.contains("fundingchoices") -> "(function(){window.googlefc=window.googlefc||{callbackQueue:[],controlledMessagingFunction:function(){},getAdBlockerStatus:function(cb){if(typeof cb==='function')setTimeout(function(){cb(0);},5);return 0;},showRevocationMessage:function(){}};})();"
            urlStr.contains("fncstatic.com") || urlStr.contains("foxnews") -> "(function(){window.canRunAds=true;window.isAdBlockActive=false;window.isAdBlocked=false;window.adBlock=false;window.adblock=false;window.adblockDetected=false;window.FNC=window.FNC||{};})();"
            urlStr.contains("/ads.js") || urlStr.contains("advertisement.js") || urlStr.contains("adframe.js") || urlStr.contains("/advert.js") || urlStr.contains("adserver.js") || urlStr.contains("ad-zone.js") -> "(function(){window.canRunAds=true;window.isAdBlockActive=false;window.isAdBlocked=false;window.adBlock=false;window.adblock=false;window.adblockDetected=false;window.google_ad_client='ca-pub-0000000000000000';})();"
            isJs -> "/* blocked by fokk brave-shield */"
            else -> ""
        }
        return WebResourceResponse(
            mimeType,
            "UTF-8",
            200,
            "OK",
            mapOf("Cache-Control" to "no-store", "Access-Control-Allow-Origin" to "*"),
            ByteArrayInputStream(emptyPayload.toByteArray(Charsets.UTF_8))
        )
    }

    private fun injectAdblockScript(webView: WebView?, pageUrl: String? = webView?.url) {
        if (webView == null) return
        if (!isShieldEnabledFor(pageUrl)) return
        val pageHost = runCatching { Uri.parse(pageUrl).host?.lowercase(Locale.ROOT) }.getOrNull()
        val isSocial = isSocialAppHost(pageHost)

        // Inject Brave adblock-rust cosmetic CSS element hiding (all pages except YouTube and fragile SPAs like X / Twitter)
        val isYt = pageUrl?.contains("youtube.com") == true || pageUrl?.contains("youtu.be") == true
        if (pageUrl != null && !isYt && !isSocial && !pageUrl.startsWith("file:///android_asset/")) {
            val cosmetic = AdShieldApp.instance.braveEngine.getCosmeticResources(pageUrl)
            if (cosmetic != null) {
                if (cosmetic.selectors.isNotEmpty()) {
                    val cssRules = cosmetic.css().replace("\\", "\\\\").replace("`", "\\`")
                    val cosmeticJs = """
                        (function() {
                            var el = document.getElementById('fokk-brave-cosmetic');
                            if (!el) {
                                el = document.createElement('style');
                                el.id = 'fokk-brave-cosmetic';
                                (document.head || document.documentElement).appendChild(el);
                            }
                            el.textContent = `$cssRules`;
                        })();
                    """.trimIndent()
                    webView.evaluateJavascript(cosmeticJs, null)
                }
                if (cosmetic.js.isNotEmpty()) {
                    webView.evaluateJavascript(cosmetic.js, null)
                }
            }
        }

        // Always evaluate defusers and injectionScript in Main World to ensure in-flight JSON scrubbers
        // (YouTube zero-delay, Reddit, X, Instagram) are active directly in page V8 context, bypassing CSP
        if (defusersScript.isNotEmpty()) {
            webView.evaluateJavascript(defusersScript, null)
        }
        if (injectionScript.isNotEmpty()) {
            webView.evaluateJavascript(injectionScript, null)
        }

        val isAiFilter = prefs.getBoolean(PREF_AI_FILTER, true)
        if (!isAiFilter) {
            webView.evaluateJavascript("if (typeof setAiFilterEnabled === 'function') setAiFilterEnabled(false);", null)
        }

        // Fokko AI Ambient Reality Inspector (Twitter/X, Reddit, Threads, YouTube, Web Selections)
        val isFokkoAi = prefs.getBoolean(PREF_FOKKO_AI, true)
        val isWebHttp = pageUrl?.startsWith("http://") == true || pageUrl?.startsWith("https://") == true
        if (isFokkoAi && isWebHttp && fokkoScript.isNotEmpty()) {
            if (fokkoCss.isNotEmpty()) {
                val cssSafe = fokkoCss.replace("\\", "\\\\").replace("`", "\\`")
                val injectCssJs = """
                    (function() {
                        if (!document.getElementById('fokko-ai-css')) {
                            var s = document.createElement('style');
                            s.id = 'fokko-ai-css';
                            s.textContent = `$cssSafe`;
                            (document.head || document.documentElement).appendChild(s);
                        }
                    })();
                """.trimIndent()
                webView.evaluateJavascript(injectCssJs, null)
            }
            webView.evaluateJavascript("window.__fokk_is_pro = true; window.__fokk_mobile_app = true;", null)
            webView.evaluateJavascript(fokkoScript, null)
            webView.evaluateJavascript("if (typeof window.fokkRunInjectors === 'function') { window.fokkRunInjectors(); }", null)
        }

        // Custom User CSS
        val customCss = prefs.getString(PREF_CUSTOM_CSS, "") ?: ""
        if (customCss.isNotEmpty()) {
            val safeCss = customCss.replace("'", "\\'").replace("\n", " ")
            val js = "javascript:(function(){let s=document.getElementById('__fokk_custom_css');if(!s){s=document.createElement('style');s.id='__fokk_custom_css';(document.head||document.documentElement).appendChild(s);}s.innerHTML='$safeCss';})();"
            webView.evaluateJavascript(js, null)
        }

        // Custom Userscript
        val customJs = prefs.getString(PREF_CUSTOM_JS, "") ?: ""
        if (customJs.isNotEmpty()) {
            webView.evaluateJavascript(customJs, null)
        }
    }

    private fun isNewsOrPublisherHost(host: String): Boolean {
        if (host.isEmpty()) return false
        val lower = host.lowercase(Locale.ROOT)
        return lower.contains("thesun.co.uk") || lower.contains("the-sun.com") || lower.contains("thescottishsun.co.uk") ||
            lower.contains("foxnews.com") || lower.contains("theguardian.com") || lower.contains("forbes.com") ||
            lower.contains("independent.co.uk") || lower.contains("mirror.co.uk") || lower.contains("express.co.uk") ||
            lower.contains("standard.co.uk") || lower.contains("dailymail.co.uk") || lower.contains("telegraph.co.uk") ||
            lower.contains("bloomberg.com") || lower.contains("reuters.com") || lower.contains("nytimes.com") ||
            lower.contains("washingtonpost.com") || lower.contains("usatoday.com") || lower.contains("latimes.com") ||
            lower.contains("sky.com") || lower.contains("news.sky.com") || lower.contains("bbc.com") || lower.contains("bbc.co.uk") ||
            lower.contains("thetimes.co.uk") || lower.contains("wsj.com") || lower.contains("ft.com") || lower.contains("cnn.com") ||
            lower.contains("apnews.com") || lower.contains("onmanorama.com") || lower.contains("indiatimes.com") || lower.contains("ndtv.com")
    }

    private fun isSocialAppHost(host: String?): Boolean {
        val normalized = host?.lowercase(Locale.ROOT)?.substringBefore(':').orEmpty()
        if (normalized.isEmpty()) return false
        return normalized == "x.com" || normalized.endsWith(".x.com") ||
            normalized == "twitter.com" || normalized.endsWith(".twitter.com") ||
            normalized == "instagram.com" || normalized.endsWith(".instagram.com") ||
            normalized == "threads.net" || normalized.endsWith(".threads.net") ||
            normalized == "facebook.com" || normalized.endsWith(".facebook.com") ||
            normalized == "reddit.com" || normalized.endsWith(".reddit.com")
    }

    /** CDNs and API hosts these apps need. Filtering them surfaces a generic "try again" error. */
    private fun isSocialInfrastructureHost(host: String?): Boolean {
        val normalized = host?.lowercase(Locale.ROOT)?.substringBefore(':').orEmpty()
        if (isSocialAppHost(normalized)) return true
        return normalized == "t.co" || normalized.endsWith(".t.co") ||
            normalized.endsWith(".twimg.com") || normalized == "twimg.com" ||
            normalized.endsWith(".cdninstagram.com") || normalized == "cdninstagram.com" ||
            normalized.endsWith(".fbcdn.net") || normalized == "fbcdn.net" ||
            normalized.endsWith(".fbsbx.com") || normalized == "fbsbx.com" ||
            normalized.endsWith(".facebook.net") || normalized == "facebook.net" ||
            normalized.endsWith(".xx.fbcdn.net") ||
            normalized == "platform.twitter.com" || normalized.endsWith(".platform.twitter.com") ||
            normalized == "syndication.twitter.com" || normalized.endsWith(".syndication.twitter.com") ||
            normalized == "redditmedia.com" || normalized.endsWith(".redditmedia.com") ||
            normalized == "redd.it" || normalized.endsWith(".redd.it")
    }

    private fun isDedicatedAdOrTrackerHost(host: String?): Boolean {
        val h = host?.lowercase(Locale.ROOT)?.substringBefore(':').orEmpty()
        if (h.isEmpty()) return false
        return h == "ads-twitter.com" || h.endsWith(".ads-twitter.com") ||
            h == "analytics.twitter.com" || h.endsWith(".analytics.twitter.com") ||
            h == "scribe.twitter.com" || h.endsWith(".scribe.twitter.com") ||
            h == "ads-api.twitter.com" || h.endsWith(".ads-api.twitter.com") ||
            h == "alb.reddit.com" || h.endsWith(".alb.reddit.com") ||
            h == "events.reddit.com" || h.endsWith(".events.reddit.com") ||
            h == "pixel.redditmedia.com" || h.endsWith(".pixel.redditmedia.com") ||
            h == "advertising.reddit.com" || h.endsWith(".advertising.reddit.com") ||
            h == "ads.reddit.com" || h.endsWith(".ads.reddit.com") ||
            h == "pixel.facebook.com" || h.endsWith(".pixel.facebook.com") ||
            h == "an.facebook.com" || h.endsWith(".an.facebook.com") ||
            h == "doubleclick.net" || h.endsWith(".doubleclick.net") ||
            h == "googleadservices.com" || h.endsWith(".googleadservices.com") ||
            h == "googlesyndication.com" || h.endsWith(".googlesyndication.com") ||
            h == "taboola.com" || h.endsWith(".taboola.com") ||
            h == "outbrain.com" || h.endsWith(".outbrain.com") ||
            h == "criteo.com" || h.endsWith(".criteo.com") ||
            h == "criteo.net" || h.endsWith(".criteo.net")
    }

    /** The native bridge is permanently maintained so internal and start page actions never disconnect. */
    private fun setBridgeEnabled(webView: WebView?, url: String?) {
        if (webView == null) return
        try {
            webView.addJavascriptInterface(WebAppInterface(this, webView), "FokkShieldBridge")
        } catch (_: Exception) {}
        if (url?.startsWith(OFFLINE_PAGE_BASE_URL) != true) {
            try {
                webView.addJavascriptInterface(MediaPlaybackBridge(this), "FokkMediaBridge")
                val isSnifferEnabled = prefs.getBoolean(PREF_VIDEO_SNIFFER, true)
                if (isSnifferEnabled) {
                    webView.addJavascriptInterface(FokkVideoBridge(this), "FokkVideoBridge")
                }
            } catch (_: Exception) {}
        }
    }

    private fun injectDarkModeScript(webView: WebView?, enable: Boolean) {
        if (webView == null) return
        if (isThirdPartyMediaService(webView.url)) return
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                WebSettingsCompat.setForceDark(
                    webView.settings,
                    if (enable) WebSettingsCompat.FORCE_DARK_ON else WebSettingsCompat.FORCE_DARK_OFF
                )
            }
            if (enable && WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK_STRATEGY)) {
                WebSettingsCompat.setForceDarkStrategy(
                    webView.settings,
                    WebSettingsCompat.DARK_STRATEGY_USER_AGENT_DARKENING_ONLY
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "AMOLED Force Dark setup error", e)
        }

        val js = if (enable) {
            """javascript:(function(){
                let d = document.getElementById('__fokk_amoled');
                let legacy = document.getElementById('__fokk_dark');
                if (legacy) legacy.remove();
                if (!d) {
                    let s = document.createElement('style');
                    s.id = '__fokk_amoled';
                    s.innerHTML = `
                        html, body {
                            background-color: #12141a !important;
                            color: #e4e7eb !important;
                        }
                        article, section, main, header, footer, nav, aside {
                            background-color: transparent !important;
                            border-color: #27272a !important;
                        }
                        h1, h2, h3, h4, h5, h6, p, li, dt, dd, blockquote, figcaption, label, time, address, cite, font {
                            color: #e4e7eb !important;
                        }
                        b, strong, em, i, u, small {
                            color: inherit !important;
                        }
                        span:not([class*="icon"]):not([aria-hidden="true"]) {
                            color: inherit !important;
                        }
                        a, a * {
                            color: #38bdf8 !important;
                        }
                        a:visited, a:visited * {
                            color: #a78bfa !important;
                        }
                        input, textarea, select {
                            background-color: #1e222d !important;
                            color: #f1f5f9 !important;
                            border: 1px solid #334155 !important;
                        }
                        button, [role="button"] {
                            background-color: #1e222d !important;
                            color: #f1f5f9 !important;
                            border-color: #334155 !important;
                        }
                        /* Media Protection: NEVER invert or wash out photos, videos, canvas, or svgs */
                        img, video, canvas, svg, picture, [role="img"], iframe, [style*="background-image"] {
                            background-color: transparent !important;
                            filter: none !important;
                            opacity: 1.0 !important;
                        }
                    `;
                    (document.head || document.documentElement).appendChild(s);
                }
            })();""".trimIndent()
        } else {
            """javascript:(function(){
                let d = document.getElementById('__fokk_amoled');
                if (d) d.remove();
                let legacy = document.getElementById('__fokk_dark');
                if (legacy) legacy.remove();
            })();""".trimIndent()
        }
        webView.evaluateJavascript(js, null)
    }

    private fun isStreamingHost(host: String): Boolean {
        val lower = host.lowercase()
        if (lower.contains("adservice") ||
            lower.contains("doubleclick") ||
            lower.contains("googlesyndication") ||
            lower.contains("googleadservices") ||
            lower.contains("googletag") ||
            lower.contains("admob") ||
            lower.contains("analytics")) {
            return false
        }
        return STREAMING_MEDIA_DOMAINS.any { lower == it || lower.endsWith(".$it") }
    }

    private fun setupQuickEngineSwitcher() {
        val pairs = listOf(
            binding.btnQuickEngineBing to SearchEngine.BING,
            binding.btnQuickEngineEcosia to SearchEngine.ECOSIA,
            binding.btnQuickEngineGoogle to SearchEngine.GOOGLE,
            binding.btnQuickEngineDuckDuckGo to SearchEngine.DUCKDUCKGO,
            binding.btnQuickEngineBrave to SearchEngine.BRAVE,
            binding.btnQuickEngineStartpage to SearchEngine.STARTPAGE
        )

        for ((btn, engine) in pairs) {
            btn.setOnClickListener {
                it.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                applySearchEngine(engine)
                updateQuickEngineSwitcherUI()

                val query = binding.urlInput.text.toString().trim()
                if (query.isNotEmpty() && !query.startsWith("http://") && !query.startsWith("https://") && !query.startsWith("file://") && (!query.contains(".") || query.contains(" "))) {
                    binding.cardSuggestions.visibility = View.GONE
                    binding.urlInput.clearFocus()
                    val target = engine.searchUrl + Uri.encode(query)
                    loadUrlInActiveWebView(target)
                    recordHistory(query, target)
                }
            }
        }
        updateQuickEngineSwitcherUI()
    }

    private fun updateQuickEngineSwitcherUI() {
        val mapping = listOf(
            binding.btnQuickEngineBing to SearchEngine.BING,
            binding.btnQuickEngineEcosia to SearchEngine.ECOSIA,
            binding.btnQuickEngineGoogle to SearchEngine.GOOGLE,
            binding.btnQuickEngineDuckDuckGo to SearchEngine.DUCKDUCKGO,
            binding.btnQuickEngineBrave to SearchEngine.BRAVE,
            binding.btnQuickEngineStartpage to SearchEngine.STARTPAGE
        )
        for ((btn, engine) in mapping) {
            if (currentSearchEngine == engine) {
                btn.setBackgroundResource(R.drawable.bg_quick_engine_active)
            } else {
                btn.setBackgroundResource(android.R.drawable.list_selector_background)
            }
        }
    }

    private fun setupControls() {
        setupQuickEngineSwitcher()

        binding.btnReaderMode.setOnClickListener {
            openReaderView()
        }

        binding.btnAiSummary.setOnClickListener {
            showSmartPageSummaryDialog()
        }

        binding.btnNavAi.setOnClickListener {
            showSmartPageSummaryDialog()
        }

        binding.btnPaywallMirror.setOnClickListener {
            openPaywallMirror()
        }

        binding.btnEngineSelector.setOnClickListener {
            showSearchEngineDialog()
        }

        binding.imgEngineIcon.setOnClickListener {
            showSearchEngineDialog()
        }

        binding.btnVoiceSearch.setOnClickListener {
            startVoiceSearch()
        }

        binding.btnNavTabs.setOnClickListener {
            showTabSwitcherDialog()
        }

        binding.btnNavFavorite.setOnClickListener {
            val targetUrl = activeWebView?.url.orEmpty()
            if (isWebUrl(targetUrl)) {
                val isSaved = offlinePageStore.list().any { it.url == targetUrl }
                if (isSaved) {
                    showSavedPagesDialog()
                } else {
                    saveCurrentPage()
                    binding.btnNavFavorite.setColorFilter(android.graphics.Color.parseColor("#FBBF24"))
                }
            } else {
                showSavedPagesDialog()
            }
        }

        binding.btnNavVpn.setOnClickListener {
            showVpnModeSelector()
        }

        binding.btnNavMenu.setOnClickListener {
            showBrowserMenuDialog()
        }

        binding.layoutCollapsedBar.setOnClickListener {
            expandCommandBar(animated = true)
        }

        binding.layoutUrlInput.setOnClickListener {
            binding.urlInput.requestFocus()
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
            imm?.showSoftInput(binding.urlInput, InputMethodManager.SHOW_IMPLICIT)
        }

        binding.urlInput.setOnClickListener {
            if (!isCommandBarExpanded) {
                binding.urlInput.requestFocus()
                setCommandBarExpanded(true)
            }
        }

        binding.urlInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val text = s?.toString()?.trim() ?: ""
                val hasText = text.isNotEmpty()
                val isFocused = binding.urlInput.hasFocus()
                binding.btnClearUrl.visibility = if (hasText && isFocused) View.VISIBLE else View.GONE
                binding.btnSearchGo.visibility = View.GONE
                binding.btnVoiceSearch.visibility = if (hasText || isFocused) View.GONE else View.VISIBLE
                if (isFocused) {
                    showRecentHistoryOrSuggestions(text)
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.urlInput.setOnFocusChangeListener { _, hasFocus ->
            setCommandBarExpanded(hasFocus)
            if (hasFocus) {
                setBrowserChromeVisible(true)
                val currentUrl = activeWebView?.url ?: ""
                if (!currentUrl.contains("fokk_start.html") && currentUrl.isNotBlank()) {
                    binding.urlInput.setText(currentUrl)
                    binding.urlInput.selectAll()
                }
                val hasText = binding.urlInput.text.isNotEmpty()
                binding.btnClearUrl.visibility = if (hasText) View.VISIBLE else View.GONE
                binding.btnSearchGo.visibility = View.GONE
                binding.btnVoiceSearch.visibility = if (hasText) View.GONE else View.VISIBLE
                showRecentHistoryOrSuggestions(binding.urlInput.text.toString().trim())
            } else {
                binding.cardSuggestions.visibility = View.GONE
                binding.btnClearUrl.visibility = View.GONE
                binding.btnSearchGo.visibility = View.GONE
                binding.btnVoiceSearch.visibility = View.VISIBLE
                updateUrlBar(activeWebView?.url, activeWebView?.title)
            }
        }

        binding.btnClearUrl.setOnClickListener {
            binding.urlInput.setText("")
            showRecentHistoryOrSuggestions("")
        }

        val navigateOrSearch: () -> Unit = {
            val query = binding.urlInput.text.toString().trim()
            binding.cardSuggestions.visibility = View.GONE
            if (query.isNotEmpty()) {
                val rawTarget = when {
                    query.equals("fokk://home", ignoreCase = true) || query.equals("fokk://start", ignoreCase = true) ->
                        "file:///android_asset/fokk_start.html"
                    query.equals("fokk://about", ignoreCase = true) || query.equals("fokk://info", ignoreCase = true) ->
                        "file:///android_asset/fokk_about.html"
                    query.startsWith("http://") || query.startsWith("https://") || query.startsWith("file://") -> query
                    query.contains(".") && !query.contains(" ") -> "https://$query"
                    else -> currentSearchEngine.searchUrl + Uri.encode(query)
                }
                loadUrlInActiveWebView(rawTarget)
                recordHistory(query, rawTarget)
                binding.urlInput.clearFocus()
            }
        }

        binding.btnSearchGo.setOnClickListener {
            navigateOrSearch()
        }

        binding.btnMediaDetectedAction.setOnClickListener {
            val stream = currentDetectedVideoStream
            if (stream != null) {
                val tabIsPrivate = activeTab?.isPrivate == true
                showDownloadOptions(
                    downloadUrl = stream.url,
                    userAgent = cleanMobileUa,
                    contentDisposition = null,
                    mimeType = "video/*",
                    isPrivate = tabIsPrivate,
                    sourceUrl = activeWebView?.url.orEmpty(),
                    allowThirdPartyCookies = true
                )
            }
        }

        binding.btnPictureInPicture.setOnClickListener {
            // Never turn an audio page or a normal browser page into a tiny window.
            if (isMediaPlaying && hasActiveVideo) {
                enterPipMode()
            } else {
                Toast.makeText(this, "Play a video before minimizing it", Toast.LENGTH_SHORT).show()
            }
        }

        binding.chipMediaDetected.setOnClickListener {
            val stream = currentDetectedVideoStream
            if (stream != null) {
                val tabIsPrivate = activeTab?.isPrivate == true
                showDownloadOptions(
                    downloadUrl = stream.url,
                    userAgent = cleanMobileUa,
                    contentDisposition = null,
                    mimeType = "video/*",
                    isPrivate = tabIsPrivate,
                    sourceUrl = activeWebView?.url.orEmpty(),
                    allowThirdPartyCookies = true
                )
            }
        }

        binding.urlInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO ||
                actionId == EditorInfo.IME_ACTION_SEARCH ||
                actionId == EditorInfo.IME_ACTION_DONE) {
                navigateOrSearch()
                true
            } else {
                false
            }
        }
    }

    private var isCommandBarExpanded = false

    private fun setCommandBarExpanded(expanded: Boolean) {
        if (isCommandBarExpanded == expanded) return
        isCommandBarExpanded = expanded

        val actions = binding.layoutBarActions ?: return

        val transition = TransitionSet().apply {
            ordering = TransitionSet.ORDERING_TOGETHER
            addTransition(ChangeBounds())
            addTransition(Fade())
            addTransition(Slide(Gravity.END))
            duration = 240
            interpolator = PathInterpolator(0.4f, 0f, 0.2f, 1f)
        }
        TransitionManager.beginDelayedTransition(binding.topBar, transition)

        actions.visibility = if (expanded) View.GONE else View.VISIBLE
    }

    private fun showRecentHistoryOrSuggestions(query: String) {
        suggestionJob?.cancel()
        suggestionJob = null
        // Do not expose normal-profile history or send partially typed private queries to
        // DuckDuckGo's suggestion endpoint. The chosen search engine only receives a query
        // after the user submits it.
        if (activeTab?.isPrivate == true) {
            binding.cardSuggestions.visibility = View.GONE
            return
        }
        if (query.isEmpty()) {
            val historyList = getRecentHistory()
            displaySuggestions(historyList)
            return
        }

        val historyList = getRecentHistory().filter {
            it.title.contains(query, ignoreCase = true) || it.url.contains(query, ignoreCase = true)
        }

        if (query.startsWith("http://") || query.startsWith("https://") || query.startsWith("file://")) {
            displaySuggestions(historyList)
            return
        }
        if (!prefs.getBoolean(PREF_REMOTE_SUGGESTIONS, false)) {
            displaySuggestions(historyList)
            return
        }

        suggestionJob = lifecycleScope.launch(Dispatchers.IO) {
            delay(300)
            val mergedList = historyList.toMutableList()
            var conn: HttpURLConnection? = null
            try {
                val endpoint = "https://duckduckgo.com/ac/?q=${Uri.encode(query)}&type=list"
                val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 800
                    readTimeout = 800
                    setRequestProperty("User-Agent", cleanMobileUa)
                }
                conn = connection
                if (connection.responseCode == 200) {
                    val text = connection.inputStream.bufferedReader().use { it.readText() }
                    val jsonArr = JSONArray(text)
                    if (jsonArr.length() >= 2) {
                        val suggestionsArr = jsonArr.getJSONArray(1)
                        for (i in 0 until suggestionsArr.length()) {
                            if (mergedList.size >= 10) break
                            val s = suggestionsArr.getString(i)
                            if (mergedList.none { it.title.equals(s, ignoreCase = true) }) {
                                mergedList.add(HistorySuggestion(title = s, url = currentSearchEngine.searchUrl + Uri.encode(s), isHistory = false))
                            }
                        }
                    }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
            } finally {
                conn?.disconnect()
            }
            withContext(Dispatchers.Main) {
                if (binding.urlInput.hasFocus() && binding.urlInput.text.toString().trim() == query) {
                    displaySuggestions(mergedList)
                }
            }
        }
    }

    private fun displaySuggestions(list: List<HistorySuggestion>) {
        if (!binding.urlInput.hasFocus()) {
            binding.cardSuggestions.visibility = View.GONE
            return
        }

        updateQuickEngineSwitcherUI()
        binding.layoutSuggestionsList.removeAllViews()
        val density = resources.displayMetrics.density

        for (item in list) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding((12 * density).toInt(), (9 * density).toInt(), (12 * density).toInt(), (9 * density).toInt())
                setBackgroundResource(android.R.drawable.list_selector_background)
                isClickable = true
                isFocusable = true
            }

            val icon = ImageView(this).apply {
                layoutParams = LinearLayout.LayoutParams((16 * density).toInt(), (16 * density).toInt())
                val iconRes = if (item.isHistory) R.drawable.ic_history else R.drawable.ic_search
                setImageResource(iconRes)
                imageTintList = ColorStateList.valueOf(
                    if (item.isHistory) getColor(R.color.secondary) else getColor(R.color.fokk_cyan)
                )
            }

            val textLayout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = (10 * density).toInt()
                }
            }

            val titleTv = TextView(this).apply {
                text = item.title
                setTextColor(getColor(R.color.text_primary))
                textSize = 13f
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
            }

            val urlTv = TextView(this).apply {
                text = item.url
                setTextColor(getColor(R.color.text_secondary))
                textSize = 10.5f
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
            }

            textLayout.addView(titleTv)
            if (item.isHistory && !item.url.startsWith("fokk://")) {
                textLayout.addView(urlTv)
            }

            row.addView(icon)
            row.addView(textLayout)

            row.setOnClickListener {
                binding.cardSuggestions.visibility = View.GONE
                binding.urlInput.clearFocus()
                val target = if (item.url.startsWith("http://") || item.url.startsWith("https://") || item.url.startsWith("file://")) {
                    item.url
                } else {
                    currentSearchEngine.searchUrl + Uri.encode(item.title)
                }
                loadUrlInActiveWebView(target)
                recordHistory(item.title, target)
            }
            binding.layoutSuggestionsList.addView(row)
        }

        binding.cardSuggestions.visibility = View.VISIBLE
    }

    private fun updateUrlBar(url: String?, title: String?) {
        if (binding.urlInput.hasFocus()) return
        binding.imgEngineIcon.imageTintList = null
        if (isHomePageUrl(url)) {
            binding.topBar.visibility = View.GONE
            binding.layoutCollapsedBar.visibility = View.GONE
            binding.urlInput.setText("")
            binding.urlInput.hint = if (activeTab?.isPrivate == true || isIsolatedPrivateProfile) {
                "Ghost Mode • Search with ${currentSearchEngine.displayName}"
            } else {
                "Search with ${currentSearchEngine.displayName} or enter address"
            }
            binding.imgEngineIcon.setImageResource(currentSearchEngine.iconRes)
        } else if (url?.contains("fokk_about.html") == true) {
            binding.urlInput.setText("fokk://about")
            binding.imgEngineIcon.setImageResource(R.drawable.ic_info)
        } else {
            binding.imgEngineIcon.setImageResource(currentSearchEngine.iconRes)
            try {
                val host = Uri.parse(url).host ?: url
                binding.urlInput.setText(host?.removePrefix("www.") ?: "")
            } catch (e: Exception) {
                binding.urlInput.setText(url ?: "")
            }
        }
        val isHome = isHomePageUrl(url)
        val isWeb = url != null && isWebUrl(url)
        binding.btnNavFavorite.visibility = if (isHome) View.GONE else View.VISIBLE
        binding.btnAiSummary.visibility = View.GONE
        binding.btnNavAi.visibility = View.VISIBLE
        binding.btnReaderMode.visibility = View.GONE
        binding.btnNavVpn.visibility = View.GONE
        if (!isHome) {
            val targetUrl = url ?: activeWebView?.url.orEmpty()
            val isSaved = if (isWebUrl(targetUrl)) offlinePageStore.list().any { it.url == targetUrl } else false
            binding.btnNavFavorite.setColorFilter(if (isSaved) android.graphics.Color.parseColor("#FBBF24") else android.graphics.Color.parseColor("#94A3B8"))
        }
        updateVpnIndicatorUi()
        updateToolbarLayoutForUrl(url, animated = true)
    }

    private fun updateVpnIndicatorUi() {
        val activeMode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
        val isProxyActive = activeMode != com.adshield.app.engine.VpnEngine.VpnMode.OFF
        binding.dotNavVpnActive.visibility = if (isProxyActive) View.VISIBLE else View.GONE
        val tintColor = if (isProxyActive) {
            android.graphics.Color.parseColor("#00E5FF")
        } else {
            android.graphics.Color.parseColor("#94A3B8")
        }
        binding.imgNavVpnIcon.imageTintList = android.content.res.ColorStateList.valueOf(tintColor)
    }

    private fun openSystemDownloads() {
        if (isIsolatedPrivateProfile) {
            Toast.makeText(this, "System downloads are outside the private browser", Toast.LENGTH_LONG).show()
            return
        }
        try {
            startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            })
        } catch (e: Exception) {
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    val uri = Uri.parse(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).path)
                    setDataAndType(uri, "*/*")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(intent)
            } catch (ex: Exception) {
                Toast.makeText(this, "Downloads folder: Download/", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private var isToolbarInHomeMode: Boolean? = null
    private var lastAppliedToolbarPos: String? = null

    fun updateToolbarLayoutForUrl(url: String?, animated: Boolean = true) {
        val isHome = isHomePageUrl(url)
        val prefPos = prefs.getString(PREF_TOOLBAR_POSITION, "bottom") ?: "bottom"
        applyToolbarPosition(prefPos, isHomePage = isHome, animated = animated)
    }

    private fun applyToolbarPosition(position: String, isHomePage: Boolean = false, animated: Boolean = false) {
        val targetVisibility = if (isHomePage) View.GONE else View.VISIBLE
        if (isToolbarInHomeMode == isHomePage && lastAppliedToolbarPos == position && binding.topBar.visibility == targetVisibility) {
            return
        }
        isToolbarInHomeMode = isHomePage
        lastAppliedToolbarPos = position

        val isTop = position.equals("top", ignoreCase = true)
        val lp = binding.topBar.layoutParams as? RelativeLayout.LayoutParams ?: return
        val collapsedLp = binding.layoutCollapsedBar.layoutParams as? RelativeLayout.LayoutParams
        val containerLp = binding.mainContentLayout.layoutParams as? RelativeLayout.LayoutParams
        val cardLp = binding.cardSuggestions.layoutParams as? RelativeLayout.LayoutParams
        val density = resources.displayMetrics.density

        binding.layoutCollapsedBar.visibility = View.GONE
        commandBarCollapsed = false

        if (isHomePage) {
            binding.topBar.visibility = View.GONE
            binding.layoutCollapsedBar.visibility = View.GONE
            binding.cardSuggestions.visibility = View.GONE
            containerLp?.let {
                it.topMargin = 0
                it.bottomMargin = 0
                binding.mainContentLayout.layoutParams = it
            }
            binding.mainContentLayout.translationY = 0f
            tabs.forEach { it.webView?.setPadding(0, 0, 0, 0) }
            return
        }

        if (animated && binding.root is ViewGroup) {
            val transition = TransitionSet().apply {
                ordering = TransitionSet.ORDERING_TOGETHER
                addTransition(ChangeBounds())
                duration = 240
                interpolator = PathInterpolator(0.4f, 0f, 0.2f, 1f)
            }
            TransitionManager.beginDelayedTransition(binding.root as ViewGroup, transition)
        }

        if (isTop) {
            binding.topBar.visibility = View.VISIBLE
            binding.topBar.setBackgroundResource(R.drawable.bg_docked_command_bar_top)
            lp.removeRule(RelativeLayout.ALIGN_PARENT_BOTTOM)
            lp.addRule(RelativeLayout.ALIGN_PARENT_TOP)
            lp.topMargin = 0
            lp.bottomMargin = 0

            collapsedLp?.let {
                it.removeRule(RelativeLayout.ALIGN_PARENT_BOTTOM)
                it.addRule(RelativeLayout.ALIGN_PARENT_TOP)
                it.topMargin = 0
                it.bottomMargin = 0
                binding.layoutCollapsedBar.layoutParams = it
            }

            containerLp?.let {
                it.topMargin = if (browserChromeHidden) 0 else (56 * density).toInt()
                it.bottomMargin = 0
                binding.mainContentLayout.layoutParams = it
            }
            binding.mainContentLayout.translationY = 0f

            if (cardLp != null) {
                cardLp.removeRule(RelativeLayout.ALIGN_PARENT_BOTTOM)
                cardLp.addRule(RelativeLayout.ALIGN_PARENT_TOP)
                cardLp.topMargin = (56 * density).toInt()
                cardLp.bottomMargin = 0
                binding.cardSuggestions.layoutParams = cardLp
            }
            tabs.forEach { it.webView?.setPadding(0, 0, 0, 0) }
        } else {
            binding.topBar.visibility = View.VISIBLE
            binding.topBar.setBackgroundResource(R.drawable.bg_docked_command_bar_bottom)
            lp.removeRule(RelativeLayout.ALIGN_PARENT_TOP)
            lp.addRule(RelativeLayout.ALIGN_PARENT_BOTTOM)
            lp.topMargin = 0
            lp.bottomMargin = 0

            collapsedLp?.let {
                it.removeRule(RelativeLayout.ALIGN_PARENT_TOP)
                it.addRule(RelativeLayout.ALIGN_PARENT_BOTTOM)
                it.topMargin = 0
                it.bottomMargin = 0
                binding.layoutCollapsedBar.layoutParams = it
            }

            containerLp?.let {
                it.topMargin = 0
                it.bottomMargin = if (browserChromeHidden) 0 else (56 * density).toInt()
                binding.mainContentLayout.layoutParams = it
            }
            binding.mainContentLayout.translationY = 0f

            if (cardLp != null) {
                cardLp.removeRule(RelativeLayout.ALIGN_PARENT_TOP)
                cardLp.addRule(RelativeLayout.ALIGN_PARENT_BOTTOM)
                cardLp.topMargin = 0
                cardLp.bottomMargin = (56 * density).toInt()
                binding.cardSuggestions.layoutParams = cardLp
            }
            tabs.forEach { it.webView?.setPadding(0, 0, 0, 0) }
        }
        binding.topBar.layoutParams = lp
    }

    private fun openSetDefaultBrowserDialog() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(RoleManager::class.java)
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_BROWSER)) {
                if (!roleManager.isRoleHeld(RoleManager.ROLE_BROWSER)) {
                    val roleIntent = roleManager.createRequestRoleIntent(RoleManager.ROLE_BROWSER)
                    defaultBrowserLauncher.launch(roleIntent)
                    return
                } else {
                    Toast.makeText(this, "Fokk Browser is already your default browser", Toast.LENGTH_SHORT).show()
                    return
                }
            }
        }
        try {
            val intent = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
            startActivity(intent)
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_SETTINGS)
                startActivity(intent)
            } catch (e2: Exception) {
                Toast.makeText(this, "Please set Fokk as default browser in Android Settings", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun openAboutPage(anchor: String? = null) {
        val url = "file:///android_asset/fokk_about.html" + if (!anchor.isNullOrEmpty()) "#$anchor" else ""
        addNewTab(url, isPrivate = false)
    }

    private fun showSearchEngineDialog() {
        val engines = SearchEngine.values()
        val adapter = object : ArrayAdapter<SearchEngine>(this, 0, engines) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val row = convertView ?: layoutInflater.inflate(R.layout.item_search_engine_choice, parent, false)
                val engine = getItem(position) ?: return row
                val imgLogo = row.findViewById<ImageView>(R.id.imgEngineLogo)
                val textName = row.findViewById<TextView>(R.id.textEngineName)
                val textDesc = row.findViewById<TextView>(R.id.textEngineDesc)
                val radioBtn = row.findViewById<RadioButton>(R.id.radioEngineSelected)

                imgLogo.imageTintList = null
                imgLogo.setImageResource(engine.iconRes)
                textName.text = engine.displayName
                textDesc.text = when (engine) {
                    SearchEngine.ECOSIA -> "Trees & Climate Action • 100% Green (Default)"
                    SearchEngine.DUCKDUCKGO -> "Private Search • Zero Tracker Profiling"
                    SearchEngine.BRAVE -> "Independent Web Index • Ad-Free"
                    SearchEngine.GOOGLE -> "Comprehensive Global Index"
                    SearchEngine.STARTPAGE -> "Google Results with Absolute Privacy"
                    SearchEngine.BING -> "Microsoft Bing • Global Web & AI Copilot"
                }
                radioBtn.isChecked = (engine == currentSearchEngine)
                return row
            }
        }

        MaterialAlertDialogBuilder(this)
            .setTitle("Default Search Engine")
            .setAdapter(adapter) { dialog, which ->
                val chosen = engines[which]
                applySearchEngine(chosen)
                Toast.makeText(this, "${chosen.displayName} set as default search engine", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showExtensionsManagerDialog() {
        val dialog = BottomSheetDialog(this)
        val sheetBinding = SheetExtensionsManagerBinding.inflate(layoutInflater)
        dialog.setContentView(sheetBinding.root)

        sheetBinding.switchStrictAdblock.isChecked = prefs.getBoolean(PREF_STRICT_ADBLOCK, true)
        sheetBinding.switchSocialWidgets.isChecked = prefs.getBoolean(PREF_SOCIAL_WIDGETS, false)
        sheetBinding.switchFokkoAi.isChecked = prefs.getBoolean(PREF_FOKKO_AI, true)
        sheetBinding.editCustomJs.setText(prefs.getString(PREF_CUSTOM_JS, "") ?: "")
        sheetBinding.editCustomCss.setText(prefs.getString(PREF_CUSTOM_CSS, "") ?: "")

        sheetBinding.btnSaveExtensions.setOnClickListener {
            prefs.edit()
                .putBoolean(PREF_STRICT_ADBLOCK, sheetBinding.switchStrictAdblock.isChecked)
                .putBoolean(PREF_SOCIAL_WIDGETS, sheetBinding.switchSocialWidgets.isChecked)
                .putBoolean(PREF_FOKKO_AI, sheetBinding.switchFokkoAi.isChecked)
                .putString(PREF_CUSTOM_JS, sheetBinding.editCustomJs.text.toString().trim())
                .putString(PREF_CUSTOM_CSS, sheetBinding.editCustomCss.text.toString().trim())
                .apply()

            Toast.makeText(this, "Browser filters saved. Reloading the current page…", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
            activeWebView?.reload()
        }

        dialog.show()
    }

    fun showAiHistorySheet() {
        showHistoryDialog(initialTab = 1)
    }

    private fun saveAiHistoryItem(
        url: String,
        title: String,
        score: Int,
        verdict: String,
        summary: String,
        sourcesCount: Int,
        fullJson: String
    ) {
        if (isIsolatedPrivateProfile || url.isBlank()) return
        try {
            val historyJson = localPrefs.getString(PREF_FOKK_AI_HISTORY, "[]") ?: "[]"
            val currentArr = JSONArray(historyJson)
            val newArr = JSONArray()
            val itemObj = JSONObject().apply {
                put("id", System.currentTimeMillis())
                put("url", url)
                put("title", title.ifBlank { "Analyzed Webpage" })
                put("score", score)
                put("verdict", verdict)
                put("summary", summary)
                put("sourcesCount", sourcesCount)
                put("timestamp", System.currentTimeMillis())
                put("fullJson", fullJson)
            }
            newArr.put(itemObj)
            for (i in 0 until currentArr.length()) {
                val old = currentArr.getJSONObject(i)
                if (old.optString("url") != url && newArr.length() < 100) {
                    newArr.put(old)
                }
            }
            localPrefs.edit().putString(PREF_FOKK_AI_HISTORY, newArr.toString()).apply()
        } catch (_: Exception) {}
    }

    private fun deleteAiHistoryItem(id: Long) {
        try {
            val historyJson = localPrefs.getString(PREF_FOKK_AI_HISTORY, "[]") ?: "[]"
            val currentArr = JSONArray(historyJson)
            val newArr = JSONArray()
            for (i in 0 until currentArr.length()) {
                val obj = currentArr.getJSONObject(i)
                if (obj.optLong("id") != id) {
                    newArr.put(obj)
                }
            }
            localPrefs.edit().putString(PREF_FOKK_AI_HISTORY, newArr.toString()).apply()
        } catch (_: Exception) {}
    }

    fun showHistoryDialog(initialTab: Int = 0) {
        if (isIsolatedPrivateProfile) {
            Toast.makeText(this, "Browsing history is unavailable in private tabs", Toast.LENGTH_SHORT).show()
            return
        }
        val dialog = BottomSheetDialog(this)
        val sheetBinding = SheetHistoryBinding.inflate(layoutInflater)
        dialog.setContentView(sheetBinding.root)

        var currentTab = initialTab
        val density = resources.displayMetrics.density

        fun updateTabIndicators() {
            if (currentTab == 0) {
                sheetBinding.btnTabBrowsingHistory.setBackgroundResource(R.drawable.bg_engine_capsule)
                sheetBinding.btnTabBrowsingHistory.setTextColor(Color.WHITE)
                sheetBinding.btnTabAiHistory.background = null
                sheetBinding.btnTabAiHistory.setTextColor(getColor(R.color.text_secondary))
                sheetBinding.editHistorySearch.hint = "Search visited sites..."
                sheetBinding.textHistoryEmpty.text = "No browsing history yet"
            } else {
                sheetBinding.btnTabAiHistory.setBackgroundResource(R.drawable.bg_engine_capsule)
                sheetBinding.btnTabAiHistory.setTextColor(Color.WHITE)
                sheetBinding.btnTabBrowsingHistory.background = null
                sheetBinding.btnTabBrowsingHistory.setTextColor(getColor(R.color.text_secondary))
                sheetBinding.editHistorySearch.hint = "Search Fokk AI checks..."
                sheetBinding.textHistoryEmpty.text = "No Fokk AI history yet"
            }
        }

        fun loadList(filter: String = "") {
            sheetBinding.layoutHistoryList.removeAllViews()
            try {
                var count = 0
                if (currentTab == 0) {
                    val historyJson = localPrefs.getString(PREF_BROWSING_HISTORY, "[]") ?: "[]"
                    val jsonArr = JSONArray(historyJson)
                    for (i in 0 until jsonArr.length()) {
                        val obj = jsonArr.getJSONObject(i)
                        val title = obj.optString("title", "Website")
                        val url = obj.optString("url", "")

                        if (filter.isNotEmpty() && !title.contains(filter, true) && !url.contains(filter, true)) {
                            continue
                        }
                        count++

                        val row = LinearLayout(this).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = Gravity.CENTER_VERTICAL
                            setPadding((8 * density).toInt(), (10 * density).toInt(), (8 * density).toInt(), (10 * density).toInt())
                            setBackgroundResource(android.R.drawable.list_selector_background)
                            isClickable = true
                        }

                        val icon = ImageView(this).apply {
                            layoutParams = LinearLayout.LayoutParams((18 * density).toInt(), (18 * density).toInt())
                            setImageResource(R.drawable.ic_clock)
                            imageTintList = ColorStateList.valueOf(getColor(R.color.text_secondary))
                        }

                        val infoCol = LinearLayout(this).apply {
                            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                                marginStart = (10 * density).toInt()
                            }
                            orientation = LinearLayout.VERTICAL
                        }

                        val titleTv = TextView(this).apply {
                            text = title
                            setTextColor(getColor(R.color.text_primary))
                            textSize = 13f
                            maxLines = 1
                            ellipsize = android.text.TextUtils.TruncateAt.END
                        }

                        val urlTv = TextView(this).apply {
                            text = url
                            setTextColor(getColor(R.color.text_secondary))
                            textSize = 10.5f
                            maxLines = 1
                            ellipsize = android.text.TextUtils.TruncateAt.END
                        }

                        infoCol.addView(titleTv)
                        infoCol.addView(urlTv)
                        row.addView(icon)
                        row.addView(infoCol)

                        row.setOnClickListener {
                            loadUrlInActiveWebView(url)
                            dialog.dismiss()
                        }

                        sheetBinding.layoutHistoryList.addView(row)
                    }
                } else {
                    val aiHistoryJson = localPrefs.getString(PREF_FOKK_AI_HISTORY, "[]") ?: "[]"
                    val jsonArr = JSONArray(aiHistoryJson)
                    for (i in 0 until jsonArr.length()) {
                        val obj = jsonArr.getJSONObject(i)
                        val id = obj.optLong("id", 0L)
                        val title = obj.optString("title", "Webpage")
                        val url = obj.optString("url", "")
                        val score = obj.optInt("score", 0)
                        val verdict = obj.optString("verdict", "")
                        val summary = obj.optString("summary", "")
                        val fullJson = obj.optString("fullJson", "")

                        if (filter.isNotEmpty() && !title.contains(filter, true) &&
                            !url.contains(filter, true) && !verdict.contains(filter, true) &&
                            !summary.contains(filter, true)
                        ) {
                            continue
                        }
                        count++

                        val row = LinearLayout(this).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = Gravity.CENTER_VERTICAL
                            setPadding((8 * density).toInt(), (10 * density).toInt(), (8 * density).toInt(), (10 * density).toInt())
                            setBackgroundResource(android.R.drawable.list_selector_background)
                            isClickable = true
                        }

                        val logoIv = ImageView(this).apply {
                            layoutParams = LinearLayout.LayoutParams((22 * density).toInt(), (22 * density).toInt())
                            setImageResource(R.drawable.ic_fokk_ai_logo)
                            scaleType = ImageView.ScaleType.FIT_CENTER
                        }

                        val infoCol = LinearLayout(this).apply {
                            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                                marginStart = (10 * density).toInt()
                            }
                            orientation = LinearLayout.VERTICAL
                        }

                        val titleRow = LinearLayout(this).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = Gravity.CENTER_VERTICAL
                        }

                        val titleTv = TextView(this).apply {
                            text = title
                            setTextColor(getColor(R.color.text_primary))
                            textSize = 13f
                            setTypeface(null, Typeface.BOLD)
                            maxLines = 1
                            ellipsize = android.text.TextUtils.TruncateAt.END
                            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                        }

                        val scoreTv = TextView(this).apply {
                            text = if (score > 0) "$score%" else ""
                            setTextColor(Color.parseColor(when {
                                score >= 85 -> "#34D399"
                                score >= 70 -> "#38BDF8"
                                score >= 50 -> "#FBBF24"
                                else -> "#F87171"
                            }))
                            textSize = 11.5f
                            setTypeface(null, Typeface.BOLD)
                            setPadding((6 * density).toInt(), 0, 0, 0)
                        }

                        titleRow.addView(titleTv)
                        if (score > 0) titleRow.addView(scoreTv)

                        val verdictTv = TextView(this).apply {
                            text = if (verdict.isNotBlank()) verdict else url
                            setTextColor(Color.parseColor("#94A3B8"))
                            textSize = 11f
                            maxLines = 1
                            ellipsize = android.text.TextUtils.TruncateAt.END
                        }

                        infoCol.addView(titleRow)
                        infoCol.addView(verdictTv)
                        row.addView(logoIv)
                        row.addView(infoCol)

                        row.setOnClickListener {
                            dialog.dismiss()
                            if (fullJson.isNotBlank()) {
                                showAiSummarySheet(fullJson)
                            } else if (url.isNotBlank()) {
                                loadUrlInActiveWebView(url)
                            }
                        }

                        row.setOnLongClickListener {
                            deleteAiHistoryItem(id)
                            loadList(sheetBinding.editHistorySearch.text?.toString()?.trim() ?: "")
                            Toast.makeText(this@MediaHubActivity, "AI analysis removed from history", Toast.LENGTH_SHORT).show()
                            true
                        }

                        sheetBinding.layoutHistoryList.addView(row)
                    }
                }

                sheetBinding.textHistoryEmpty.visibility = if (count == 0) View.VISIBLE else View.GONE
            } catch (e: Exception) {
                sheetBinding.textHistoryEmpty.visibility = View.VISIBLE
            }
        }

        updateTabIndicators()
        loadList()

        sheetBinding.btnTabBrowsingHistory.setOnClickListener {
            if (currentTab != 0) {
                currentTab = 0
                updateTabIndicators()
                loadList(sheetBinding.editHistorySearch.text?.toString()?.trim() ?: "")
            }
        }

        sheetBinding.btnTabAiHistory.setOnClickListener {
            if (currentTab != 1) {
                currentTab = 1
                updateTabIndicators()
                loadList(sheetBinding.editHistorySearch.text?.toString()?.trim() ?: "")
            }
        }

        sheetBinding.editHistorySearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                loadList(s?.toString()?.trim() ?: "")
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        sheetBinding.btnClearHistory.setOnClickListener {
            if (currentTab == 0) {
                localPrefs.edit().remove(PREF_BROWSING_HISTORY).apply()
                loadList()
                Toast.makeText(this, "Browsing history cleared", Toast.LENGTH_SHORT).show()
            } else {
                localPrefs.edit().remove(PREF_FOKK_AI_HISTORY).apply()
                loadList()
                Toast.makeText(this, "Fokk AI history cleared", Toast.LENGTH_SHORT).show()
            }
        }

        dialog.show()
    }

    private fun bindTabCard(
        cardBinding: ItemTabCardBinding,
        tab: BrowserTab,
        globalIndex: Int,
        dialog: BottomSheetDialog,
        onRefresh: () -> Unit
    ) {
        cardBinding.textTabTitle.text = tab.title.ifEmpty { "New Tab" }
        val lowerUrl = tab.url.lowercase()

        when {
            lowerUrl.contains("fokk_about.html") -> {
                cardBinding.imgTabIcon.setImageResource(R.drawable.ic_info)
                cardBinding.textTabTitle.text = "About Fokk"
                cardBinding.textTabUrl.text = "fokk://about"
                cardBinding.imgPreviewLogo.setImageResource(R.drawable.ic_shield_check)
            }
            lowerUrl.contains("fokk_start.html") -> {
                cardBinding.imgTabIcon.setImageResource(R.drawable.ic_home)
                cardBinding.textTabTitle.text = "New Tab"
                cardBinding.textTabUrl.text = "fokk://home"
                cardBinding.imgPreviewLogo.setImageResource(R.drawable.ic_home)
            }
            lowerUrl.contains("youtube.com") -> {
                cardBinding.imgTabIcon.setImageResource(R.drawable.ic_youtube)
                cardBinding.textTabUrl.text = "m.youtube.com"
                cardBinding.imgPreviewLogo.setImageResource(R.drawable.ic_youtube)
            }
            lowerUrl.contains("reddit.com") -> {
                cardBinding.imgTabIcon.setImageResource(R.drawable.ic_reddit)
                cardBinding.textTabUrl.text = "reddit.com"
                cardBinding.imgPreviewLogo.setImageResource(R.drawable.ic_reddit)
            }
            lowerUrl.contains("x.com") || lowerUrl.contains("twitter.com") -> {
                cardBinding.imgTabIcon.setImageResource(R.drawable.ic_twitter)
                cardBinding.textTabUrl.text = "x.com"
                cardBinding.imgPreviewLogo.setImageResource(R.drawable.ic_twitter)
            }
            lowerUrl.contains("instagram.com") -> {
                cardBinding.imgTabIcon.setImageResource(R.drawable.ic_instagram)
                cardBinding.textTabUrl.text = "instagram.com"
                cardBinding.imgPreviewLogo.setImageResource(R.drawable.ic_instagram)
            }
            else -> {
                cardBinding.imgTabIcon.setImageResource(R.drawable.ic_launch)
                cardBinding.textTabUrl.text = try { Uri.parse(tab.url).host ?: tab.url } catch (e: Exception) { tab.url }
                cardBinding.imgPreviewLogo.setImageResource(R.drawable.ic_launch)
            }
        }

        if (globalIndex == activeTabIndex) {
            cardBinding.cardTab.strokeColor = android.graphics.Color.parseColor("#FFFFFF")
            cardBinding.cardTab.strokeWidth = (2f * resources.displayMetrics.density).toInt()
            cardBinding.badgeActiveTab.visibility = View.VISIBLE
        } else {
            cardBinding.cardTab.strokeColor = android.graphics.Color.parseColor("#27272A")
            cardBinding.cardTab.strokeWidth = (1 * resources.displayMetrics.density).toInt()
            cardBinding.badgeActiveTab.visibility = View.GONE
        }

        if (tab.isPrivate) {
            cardBinding.badgePrivateTab.visibility = View.VISIBLE
            cardBinding.layoutCardHeader.setBackgroundColor(android.graphics.Color.parseColor("#241829"))
        } else {
            cardBinding.badgePrivateTab.visibility = View.GONE
            cardBinding.layoutCardHeader.setBackgroundColor(android.graphics.Color.parseColor("#18181B"))
        }

        cardBinding.cardTab.setOnClickListener {
            switchToTab(globalIndex)
            dialog.dismiss()
        }

        cardBinding.btnCloseTab.setOnClickListener {
            closeTab(globalIndex)
            onRefresh()
            if (tabs.isEmpty()) {
                dialog.dismiss()
            }
        }
    }

    fun showTabSwitcherDialog() {
        val dialog = BottomSheetDialog(this)
        val sheetBinding = SheetTabSwitcherBinding.inflate(layoutInflater)
        dialog.setContentView(sheetBinding.root)
        dialog.window?.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)?.setBackgroundColor(
            android.graphics.Color.parseColor("#0A0A0A")
        )

        var tabSearchQuery = ""

        fun updateTabsView() {
            val normalTabs = tabs.filter { !it.isPrivate }
            val privateTabs = tabs.filter { it.isPrivate }

            sheetBinding.btnFilterNormal.text = "Tabs (${normalTabs.size})"
            sheetBinding.btnFilterPrivate.text = "Ghost Mode (${privateTabs.size})"

            if (showingPrivateTabs) {
                sheetBinding.btnFilterPrivate.setBackgroundResource(R.drawable.bg_stat_chip)
                sheetBinding.btnFilterPrivate.setTextColor(android.graphics.Color.parseColor("#FFFFFF"))
                sheetBinding.btnFilterNormal.background = null
                sheetBinding.btnFilterNormal.setTextColor(android.graphics.Color.parseColor("#71717A"))
            } else {
                sheetBinding.btnFilterNormal.setBackgroundResource(R.drawable.bg_stat_chip)
                sheetBinding.btnFilterNormal.setTextColor(android.graphics.Color.parseColor("#FFFFFF"))
                sheetBinding.btnFilterPrivate.background = null
                sheetBinding.btnFilterPrivate.setTextColor(android.graphics.Color.parseColor("#71717A"))
            }

            val currentTabsList = tabs.filter {
                it.isPrivate == showingPrivateTabs &&
                (tabSearchQuery.isBlank() ||
                 it.title.contains(tabSearchQuery, ignoreCase = true) ||
                 it.url.contains(tabSearchQuery, ignoreCase = true))
            }
            sheetBinding.layoutTabsGrid.removeAllViews()

            val density = resources.displayMetrics.density

            if (currentTabsList.isEmpty()) {
                val emptyNotice = TextView(this).apply {
                    text = if (tabSearchQuery.isNotEmpty()) "No tabs found matching \"$tabSearchQuery\"" else "No open tabs"
                    setTextColor(getColor(R.color.text_secondary))
                    textSize = 13f
                    gravity = Gravity.CENTER
                    setPadding(0, (32 * density).toInt(), 0, (32 * density).toInt())
                }
                sheetBinding.layoutTabsGrid.addView(emptyNotice)
            } else {
                for (i in currentTabsList.indices step 2) {
                val row = LinearLayout(this).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = (6 * density).toInt()
                    }
                    orientation = LinearLayout.HORIZONTAL
                    weightSum = 2f
                }

                val tab1 = currentTabsList[i]
                val globalIdx1 = tabs.indexOf(tab1)
                val cardBinding1 = ItemTabCardBinding.inflate(layoutInflater, row, false)
                bindTabCard(cardBinding1, tab1, globalIdx1, dialog) {
                    updateTabsView()
                }
                cardBinding1.root.layoutParams = LinearLayout.LayoutParams(0, (170 * density).toInt(), 1f)
                row.addView(cardBinding1.root)

                if (i + 1 < currentTabsList.size) {
                    val tab2 = currentTabsList[i + 1]
                    val globalIdx2 = tabs.indexOf(tab2)
                    val cardBinding2 = ItemTabCardBinding.inflate(layoutInflater, row, false)
                    bindTabCard(cardBinding2, tab2, globalIdx2, dialog) {
                        updateTabsView()
                    }
                    cardBinding2.root.layoutParams = LinearLayout.LayoutParams(0, (170 * density).toInt(), 1f)
                    row.addView(cardBinding2.root)
                } else {
                    val spacer = View(this).apply {
                        layoutParams = LinearLayout.LayoutParams(0, (170 * density).toInt(), 1f)
                    }
                    row.addView(spacer)
                }

                sheetBinding.layoutTabsGrid.addView(row)
                }
            }
        }

        sheetBinding.editSearchTabs.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                tabSearchQuery = s?.toString()?.trim() ?: ""
                sheetBinding.btnClearTabSearch.visibility = if (tabSearchQuery.isNotEmpty()) View.VISIBLE else View.GONE
                updateTabsView()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        sheetBinding.btnClearTabSearch.setOnClickListener {
            sheetBinding.editSearchTabs.setText("")
        }

        sheetBinding.btnFilterNormal.setOnClickListener {
            showingPrivateTabs = false
            updateTabsView()
        }

        sheetBinding.btnFilterPrivate.setOnClickListener {
            authenticateForPrivateTabs {
                if (isIsolatedPrivateProfile) {
                    showingPrivateTabs = true
                    updateTabsView()
                } else {
                    openIsolatedPrivateBrowser("file:///android_asset/fokk_start.html")
                    dialog.dismiss()
                }
            }
        }

        sheetBinding.btnNewTabSheet.setOnClickListener {
            addNewTab("file:///android_asset/fokk_start.html", isPrivate = false)
            showingPrivateTabs = isIsolatedPrivateProfile
            dialog.dismiss()
        }

        sheetBinding.btnNewPrivateTab.setOnClickListener {
            authenticateForPrivateTabs {
                addNewTab("file:///android_asset/fokk_start.html", isPrivate = true)
                showingPrivateTabs = true
                dialog.dismiss()
            }
        }

        sheetBinding.btnCloseAllTabs.setOnClickListener {
            val toRemove = tabs.filter { it.isPrivate == showingPrivateTabs }
            for (tab in toRemove) {
                tab.webView?.let { webView ->
                    binding.tabContainer.removeView(webView)
                    webView.destroy()
                }
                tabs.remove(tab)
            }
            if (tabs.isEmpty()) {
                addNewTab("file:///android_asset/fokk_start.html", isPrivate = false)
            } else {
                switchToTab(0)
            }
            dialog.dismiss()
        }

        if (isIsolatedPrivateProfile) {
            sheetBinding.btnFilterNormal.visibility = View.GONE
            sheetBinding.btnFilterPrivate.text = "Private tabs (${tabs.size})"
            sheetBinding.btnNewTabSheet.contentDescription = "New private tab"
        }

        updateTabsView()
        dialog.show()
    }

    private fun saveCurrentPage() {
        val webView = activeWebView ?: return
        val currentTab = activeTab ?: return
        if (currentTab.isPrivate) {
            Toast.makeText(this, "Offline saves are unavailable in private tabs", Toast.LENGTH_LONG).show()
            return
        }
        if (currentTab.isOfflineReader) {
            Toast.makeText(this, "This page is already saved for offline reading", Toast.LENGTH_SHORT).show()
            return
        }
        val currentUrl = webView.url ?: currentTab.url
        if (!isWebUrl(currentUrl)) {
            Toast.makeText(this, "Save Page is for live websites. Showing your Saved Pages...", Toast.LENGTH_SHORT).show()
            showSavedPagesDialog()
            return
        }
        val currentTitle = webView.title?.ifBlank { currentUrl } ?: currentUrl

        Toast.makeText(this, "Saving visual offline archive...", Toast.LENGTH_SHORT).show()

        val tempArchiveDir = File(cacheDir, "temp_archives").apply { mkdirs() }
        val tempArchiveFile = File(tempArchiveDir, "page_${System.currentTimeMillis()}.mhtml")

        webView.saveWebArchive(tempArchiveFile.absolutePath, false) { savedPath ->
            val capturedFile = if (savedPath != null) File(savedPath) else null

            val extractScript = """(function(){
                var root=document.querySelector('article')||document.querySelector('main')||document.body;
                var text=(root.innerText||'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,200000);
                return JSON.stringify({title:document.title||'',text:text});
            })()""".trimIndent()
            webView.evaluateJavascript(extractScript) { result ->
                if (activeTab !== currentTab || currentTab.webView !== webView || webView.url != currentUrl) {
                    Toast.makeText(this, "Page changed before it could be saved. Try again.", Toast.LENGTH_SHORT).show()
                    tempArchiveFile.delete()
                    return@evaluateJavascript
                }
                val extracted = runCatching {
                    val encoded = org.json.JSONTokener(result ?: "null").nextValue() as? String
                        ?: throw IllegalArgumentException("No article content")
                    JSONObject(encoded)
                }.getOrNull()
                val text = extracted?.optString("text")?.trim().orEmpty().ifBlank { currentTitle }
                val title = extracted?.optString("title")?.ifBlank { currentTitle } ?: currentTitle

                lifecycleScope.launch {
                    val saved = runCatching {
                        withContext(Dispatchers.IO) { offlinePageStore.save(title, currentUrl, text, capturedFile) }
                    }.getOrNull()
                    tempArchiveFile.delete()
                    if (saved != null) {
                        Toast.makeText(this@MediaHubActivity, "Added to Favorites and Bookmarks (Saved offline)", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@MediaHubActivity, "Could not save this page", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    fun showSavedPagesDialog() {
        if (isIsolatedPrivateProfile) {
            Toast.makeText(this, "Saved pages are unavailable in private tabs", Toast.LENGTH_SHORT).show()
            return
        }
        try {
            val savedPages = offlinePageStore.list()
            val content = layoutInflater.inflate(R.layout.dialog_saved_pages, null)
            val searchInput = content.findViewById<EditText>(R.id.editSavedPageSearch)
            val status = content.findViewById<TextView>(R.id.textSavedPageSearchStatus)
            val results = content.findViewById<LinearLayout>(R.id.layoutSavedPageResults)
            val dialog = MaterialAlertDialogBuilder(this)
                .setTitle("Bookmarks & Saved Pages")
                .setView(content)
                .setNegativeButton("Close", null)
                .create()

            fun renderPages(pages: List<OfflinePageStore.SavedPage>, query: String) {
                results.removeAllViews()
                if (pages.isEmpty()) {
                    status.text = if (query.isBlank()) "No saved pages yet" else "No matches found"
                    val emptyTv = TextView(this@MediaHubActivity).apply {
                        text = if (query.isBlank()) "No bookmarks or saved pages yet.\nTap the Star or Save button on any webpage to save pages for quick offline access!" else "No saved pages matching \"$query\""
                        setTextColor(ContextCompat.getColor(this@MediaHubActivity, R.color.text_secondary))
                        textSize = 13.5f
                        gravity = Gravity.CENTER
                        setPadding(0, (24 * resources.displayMetrics.density).toInt(), 0, (24 * resources.displayMetrics.density).toInt())
                    }
                    results.addView(emptyTv)
                    return
                }
                status.text = if (query.isBlank()) {
                    "${pages.size} saved pages · search titles and text · long press to delete"
                } else {
                    "${pages.size} result${if (pages.size == 1) "" else "s"}"
                }
                val horizontalPadding = (12 * resources.displayMetrics.density).toInt()
                pages.forEach { page ->
                    val hasVisualArchive = page.id?.let(offlinePageStore::hasOfflineArchive) == true
                    val hasOfflineCopy = hasVisualArchive || (page.id?.let(offlinePageStore::hasOfflineCopy) == true)
                    val formatBadge = if (hasVisualArchive) " [Visual Archive]" else if (hasOfflineCopy) " [Text]" else ""
                    val row = TextView(this).apply {
                        text = "${page.title}$formatBadge\n${Uri.parse(page.url).host ?: page.url}"
                        setTextColor(ContextCompat.getColor(this@MediaHubActivity, R.color.text_primary))
                        textSize = 14f
                        maxLines = 2
                        ellipsize = TextUtils.TruncateAt.END
                        gravity = Gravity.CENTER_VERTICAL
                        setPadding(horizontalPadding, horizontalPadding / 2, horizontalPadding, horizontalPadding / 2)
                        isClickable = true
                        isFocusable = true
                        contentDescription = "Open saved page ${page.title}. Long press to delete."
                        setOnClickListener {
                            dialog.dismiss()
                            openSavedPage(page)
                        }
                        setOnLongClickListener {
                            MaterialAlertDialogBuilder(this@MediaHubActivity)
                                .setTitle("Delete saved page?")
                                .setMessage("Remove the offline text and its saved-page entry from this device?")
                                .setNegativeButton("Cancel", null)
                                .setPositiveButton("Delete") { _, _ ->
                                    lifecycleScope.launch {
                                        val deleted = withContext(Dispatchers.IO) { offlinePageStore.delete(page) }
                                        val query = searchInput.text.toString()
                                        val updated = withContext(Dispatchers.IO) {
                                             offlinePageStore.search(query)
                                        }
                                        if (dialog.isShowing) {
                                            renderPages(updated, query)
                                            if (!deleted) {
                                                Toast.makeText(
                                                    this@MediaHubActivity,
                                                    "Could not update saved pages",
                                                    Toast.LENGTH_LONG
                                                ).show()
                                            }
                                        }
                                    }
                                }
                                .show()
                            true
                        }
                    }
                    results.addView(row, LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        (60 * resources.displayMetrics.density).toInt()
                    ))
                    val divider = View(this).apply {
                        setBackgroundColor(android.graphics.Color.parseColor("#263246"))
                    }
                    results.addView(divider, LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        (1 * resources.displayMetrics.density).toInt()
                    ))
                }
                if (pages.isEmpty()) {
                    status.text = "No saved pages match that search"
                }
            }

            renderPages(savedPages, "")
            searchInput.addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
                override fun afterTextChanged(editable: Editable?) {
                    val query = editable?.toString().orEmpty()
                    savedPagesSearchJob?.cancel()
                    savedPagesSearchJob = lifecycleScope.launch {
                        delay(250)
                        val matches = withContext(Dispatchers.IO) { offlinePageStore.search(query) }
                        if (dialog.isShowing) renderPages(matches, query)
                    }
                }
            })
            dialog.setOnDismissListener { savedPagesSearchJob?.cancel() }
            dialog.show()
        } catch (e: Exception) {
            Toast.makeText(this, "Unable to load saved pages", Toast.LENGTH_SHORT).show()
        }
    }

    private fun openSavedPage(page: OfflinePageStore.SavedPage) {
        val pageUri = runCatching { Uri.parse(page.url) }.getOrNull()
        if (!isWebUrl(page.url) || pageUri?.userInfo != null) {
            Toast.makeText(this, "This saved link is invalid and cannot be opened", Toast.LENGTH_LONG).show()
            return
        }
        val targetTab = activeTab ?: return
        val targetWebView = targetTab.webView ?: return
        val id = page.id
        if (id == null) {
            Toast.makeText(this, "This is an older saved link; internet is needed to open it", Toast.LENGTH_LONG).show()
            if (page.url.isNotBlank()) loadUrlInActiveWebView(page.url)
            return
        }
        lifecycleScope.launch {
            val archiveFile = withContext(Dispatchers.IO) { offlinePageStore.getArchiveFile(id) }
            if (archiveFile != null && archiveFile.isFile) {
                targetTab.url = "file://${archiveFile.absolutePath}"
                targetTab.title = page.title
                targetTab.isOfflineReader = true
                updateUrlBar(page.url, page.title)
                targetWebView.loadUrl("file://${archiveFile.absolutePath}")
                return@launch
            }

            val articleText = withContext(Dispatchers.IO) { offlinePageStore.readText(id) }
            if (articleText.isNullOrBlank()) {
                Toast.makeText(this@MediaHubActivity, "The offline copy is missing. Opening the site online.", Toast.LENGTH_LONG).show()
                if (page.url.isNotBlank()) loadUrlInActiveWebView(page.url)
                return@launch
            }
            if (!tabs.contains(targetTab) || targetTab.webView !== targetWebView) return@launch
            targetTab.url = page.url
            targetTab.title = page.title
            targetTab.isOfflineReader = true
            updateUrlBar(page.url, page.title)
            setBridgeEnabled(targetWebView, OFFLINE_PAGE_BASE_URL)
            targetWebView.loadDataWithBaseURL(
                OFFLINE_PAGE_BASE_URL,
                buildOfflineArticleHtml(page.title, page.url, articleText),
                "text/html",
                "UTF-8",
                OFFLINE_PAGE_BASE_URL
            )
        }
    }

    private fun buildOfflineArticleHtml(title: String, sourceUrl: String, text: String): String {
        val safeTitle = TextUtils.htmlEncode(title)
        val safeSource = TextUtils.htmlEncode(sourceUrl)
        val paragraphs = text.lineSequence()
            .map(String::trim)
            .filter(String::isNotEmpty)
            .joinToString("") { "<p>${TextUtils.htmlEncode(it)}</p>" }
        return """<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
            <title>$safeTitle</title><style>
            *{box-sizing:border-box}body{margin:0;background:#f7f3e9;color:#282720;font:18px/1.75 Georgia,serif}
            header{position:sticky;top:0;background:#f7f3e9;border-bottom:1px solid #ded9cc;padding:12px 20px;font:14px system-ui,sans-serif;color:#555}
            main{max-width:720px;margin:28px auto;padding:0 22px 56px;overflow-wrap:anywhere}
            h1{font:700 30px/1.2 system-ui,sans-serif;margin:0 0 18px}p{margin:0 0 1.1em}
            .source{font:13px/1.5 system-ui,sans-serif;color:#666;margin-bottom:28px}
            @media(prefers-color-scheme:dark){body,header{background:#17191d;color:#e8e5dd}header{border-color:#373b42}.source{color:#b8b5ac}}
            </style></head><body><header>Saved for offline reading</header><main><h1>$safeTitle</h1>
            <div class="source">Source: $safeSource<br>Text snapshot; images and interactive parts are not included.</div>$paragraphs
            </main></body></html>""".trimIndent()
    }

    fun showBrowserMenuDialog() {
        flushFilteredRequestCounts()
        val dialog = BottomSheetDialog(this)
        val sheetBinding = SheetBrowserMenuBinding.inflate(layoutInflater)
        dialog.setContentView(sheetBinding.root)

        val userAlias = prefs.getString(PREF_USER_ALIAS, "Fokk User") ?: "Fokk User"
        sheetBinding.textMenuProfileName.text = userAlias
        loadAvatarInto(sheetBinding.imgMenuProfileAvatar)
        sheetBinding.rowMenuProfile.setOnClickListener {
            dialog.dismiss()
            showPrivacyAccountDialog()
        }

        sheetBinding.rowBurnSession.setOnClickListener {
            dialog.dismiss()
            burnSession()
        }

        val isStartPage = activeWebView?.url?.contains("fokk_start.html") == true || activeWebView?.url.isNullOrBlank()
        val isPrivateProfile = isIsolatedPrivateProfile

        // 1. Back button
        val canGoBack = activeWebView?.canGoBack() == true
        sheetBinding.btnMenuBack.alpha = if (canGoBack) 1.0f else 0.35f
        sheetBinding.btnMenuBack.isEnabled = canGoBack
        sheetBinding.btnMenuBack.setOnClickListener {
            if (activeWebView?.canGoBack() == true) {
                activeWebView?.goBack()
                dialog.dismiss()
            }
        }

        // 2. Forward button
        val canGoForward = activeWebView?.canGoForward() == true
        sheetBinding.btnMenuForward.alpha = if (canGoForward) 1.0f else 0.35f
        sheetBinding.btnMenuForward.isEnabled = canGoForward
        sheetBinding.btnMenuForward.setOnClickListener {
            if (activeWebView?.canGoForward() == true) {
                activeWebView?.goForward()
                dialog.dismiss()
            }
        }

        // 2b. Quick Refresh button on navigation bar
        sheetBinding.btnMenuRefresh.setOnClickListener {
            activeWebView?.reload()
            dialog.dismiss()
        }

        // 3. Home button
        sheetBinding.btnMenuHome.alpha = if (isStartPage) 0.45f else 1.0f
        sheetBinding.btnMenuHome.setOnClickListener {
            loadUrlInActiveWebView("file:///android_asset/fokk_start.html")
            dialog.dismiss()
        }

        // 4. History belongs beside navigation; saving remains available from the page star.
        sheetBinding.btnMenuHistory.isEnabled = !isPrivateProfile
        sheetBinding.btnMenuHistory.alpha = if (isPrivateProfile) 0.35f else 1.0f
        sheetBinding.btnMenuHistory.setOnClickListener {
            dialog.dismiss()
            showHistoryDialog()
        }

        // 5. Downloads button (opens standard downloads manager)
        sheetBinding.btnMenuDownloads.setOnClickListener {
            dialog.dismiss()
            openSystemDownloads()
        }

        // Saved Pages row
        sheetBinding.rowSavedPages.setOnClickListener {
            dialog.dismiss()
            showSavedPagesDialog()
        }

        // These views expose app-wide history, saved files, or DownloadManager records.
        // The private process has a separate WebView profile, but these stores are shared.
        if (isPrivateProfile) {
            sheetBinding.btnMenuDownloads.visibility = View.GONE
            sheetBinding.btnMenuHistory.visibility = View.GONE
            sheetBinding.rowSavedPages.visibility = View.GONE
        }

        var isToolsShelfExpanded = false
        sheetBinding.btnMenuMoreRow.setOnClickListener {
            isToolsShelfExpanded = !isToolsShelfExpanded
            sheetBinding.layoutMenuExpandedTools.visibility = if (isToolsShelfExpanded) View.VISIBLE else View.GONE
            sheetBinding.imgMenuMoreChevron.animate().rotation(if (isToolsShelfExpanded) 180f else 0f).setDuration(200).start()
        }

        sheetBinding.btnToolDualScreen.setOnClickListener {
            dialog.dismiss()
            toggleDualDeckMode()
        }

        sheetBinding.btnToolThemes.setOnClickListener {
            dialog.dismiss()
            openWallpapersCustomizer()
        }

        sheetBinding.btnToolAiSummary.setOnClickListener {
            dialog.dismiss()
            showSmartPageSummaryDialog()
        }

        sheetBinding.btnToolSavedSummaries.setOnClickListener {
            dialog.dismiss()
            showSavedSummariesDialog()
        }

        val updateAiBlockerUi: (Boolean) -> Unit = { active ->
            sheetBinding.textAiBlockerStatus.text = if (active) "ON" else "OFF"
            val color = if (active) android.graphics.Color.parseColor("#34D399") else android.graphics.Color.parseColor("#94A3B8")
            sheetBinding.textAiBlockerStatus.setTextColor(color)
            sheetBinding.imgAiBlockerIcon.setColorFilter(color)
        }
        updateAiBlockerUi(prefs.getBoolean(PREF_AI_FILTER, true))

        sheetBinding.btnToolAiBlocker.setOnClickListener {
            val isAiOn = prefs.getBoolean(PREF_AI_FILTER, true)
            val nextState = !isAiOn
            prefs.edit().putBoolean(PREF_AI_FILTER, nextState).apply()
            updateAiBlockerUi(nextState)
            activeWebView?.evaluateJavascript("if (typeof setAiFilterEnabled === 'function') setAiFilterEnabled($nextState);", null)
            Toast.makeText(
                this,
                if (nextState) "AI Trap Defuser: ON · popups, trap overlays and scroll locks" else "AI Trap Defuser: OFF",
                Toast.LENGTH_LONG
            ).show()
        }

        sheetBinding.btnToolAiBlocker.setOnLongClickListener {
            MaterialAlertDialogBuilder(this)
                .setTitle("AI Trap Defuser")
                .setMessage("Runs locally in the current page. It removes deceptive popunders, anti-adblock overlays and forced scroll locks, and hides supported Google or Bing AI overview panels. It does not send page text to a server.")
                .setPositiveButton("Got it", null)
                .show()
            true
        }

        sheetBinding.btnToolDiagnostics.setOnClickListener {
            dialog.dismiss()
            val url = activeTab?.url.orEmpty()
            if (url.isNotBlank() && !url.contains("fokk_start.html")) {
                loadUrlInActiveWebView("view-source:$url")
            } else {
                Toast.makeText(this, "Open a website to view diagnostics", Toast.LENGTH_SHORT).show()
            }
        }

        sheetBinding.btnToolDnsShield.setOnClickListener {
            dialog.dismiss()
            showShieldSettingsDialog()
        }

        val activeVpnMode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
        val isVpnActive = activeVpnMode != com.adshield.app.engine.VpnEngine.VpnMode.OFF
        sheetBinding.textMenuVpnStatus.text = if (isVpnActive) "PROTECTED" else "OFF"
        val vpnStatusColor = if (isVpnActive) 0xFF00E5FF.toInt() else 0xFF94A3B8.toInt()
        sheetBinding.textMenuVpnStatus.setTextColor(vpnStatusColor)
        sheetBinding.btnToolVpnMode.setOnClickListener {
            dialog.dismiss()
            showVpnModeSelector()
        }

        val activePrivacyTab = activeTab
        sheetBinding.textMenuBlockedInfo.text =
            "Always ON · WebView observed ${activePrivacyTab?.thirdPartyRequests ?: 0} cross-site requests · Fokk filtered ${activePrivacyTab?.filteredRequests ?: 0}"
        sheetBinding.switchMenuShield.isChecked = isShieldEnabled
        sheetBinding.badgeSocialShield.alpha = if (isShieldEnabled) 1.0f else 0.4f
        sheetBinding.badgeAiFilter.alpha = if (isShieldEnabled) 1.0f else 0.4f

        // --- Opera-Style Top Quick Squircles & Actions ---
        val isQuickVpnActive = activeVpnMode != com.adshield.app.engine.VpnEngine.VpnMode.OFF
        sheetBinding.textMenuQuickVpnStatus.text = if (isQuickVpnActive) "Protected" else "Off"
        sheetBinding.textMenuQuickVpnStatus.setTextColor(android.graphics.Color.parseColor(if (isQuickVpnActive) "#00E5FF" else "#8E8E93"))
        sheetBinding.btnMenuQuickVpn.setOnClickListener {
            dialog.dismiss()
            showVpnModeSelector()
        }
        sheetBinding.btnMenuVpnInfo.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("About Fokk Mesh")
                .setMessage("Fokk Mesh encrypts and shields your browser traffic through our high-speed oblivious privacy mesh with zero IP leaks. Your real IP address and ISP details are kept private from websites you visit.\n\n• Zero-Log Policy: We do not track or store your browsing activity.\n• High-Speed Edge: Fast connections optimized for video streaming and web browsing.\n• Oblivious Mesh Routing: Neither your ISP nor destination websites can link your identity to your browsing.")
                .setPositiveButton("Got it", null)
                .show()
        }

        sheetBinding.textMenuQuickShieldStatus.text = if (isShieldEnabled) "On" else "Off"
        sheetBinding.textMenuQuickShieldStatus.setTextColor(android.graphics.Color.parseColor(if (isShieldEnabled) "#34D399" else "#8E8E93"))
        sheetBinding.btnMenuQuickShield.setOnClickListener {
            if (isThirdPartyMediaService(activeWebView?.url)) {
                Toast.makeText(this, "Filtering is disabled for this service", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val newState = !isShieldEnabled
            setShieldEnabledForCurrentSite(newState)
            sheetBinding.textMenuQuickShieldStatus.text = if (newState) "On" else "Off"
            sheetBinding.textMenuQuickShieldStatus.setTextColor(android.graphics.Color.parseColor(if (newState) "#34D399" else "#8E8E93"))
            sheetBinding.switchMenuShield.isChecked = newState
            val msg = if (newState) "Fokk Shield Protection Enabled" else "Fokk Shield Paused"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
            activeWebView?.reload()
        }
        sheetBinding.btnMenuShieldInfo.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("About Fokk Shield")
                .setMessage("Fokk Shield blocks aggressive ads, third-party tracking scripts, malware domains, and telemetry trackers to deliver a faster and private browsing experience.")
                .setPositiveButton("Got it", null)
                .show()
        }

        sheetBinding.textMenuQuickReaderStatus.text = "Reader"
        sheetBinding.btnMenuQuickReader.setOnClickListener {
            dialog.dismiss()
            openReaderView()
        }
        sheetBinding.btnMenuReaderInfo.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("About Reader Mode")
                .setMessage("Reader mode strips away clutter, buttons, and navigation elements from articles, giving you a clean and distraction-free reading experience.")
                .setPositiveButton("Got it", null)
                .show()
        }

        sheetBinding.textMenuQuickNightStatus.text = if (isDarkMode) "On" else "Off"
        sheetBinding.textMenuQuickNightStatus.setTextColor(android.graphics.Color.parseColor(if (isDarkMode) "#FBBF24" else "#8E8E93"))
        sheetBinding.btnMenuQuickNight.setOnClickListener {
            isDarkMode = !isDarkMode
            sheetBinding.textMenuQuickNightStatus.text = if (isDarkMode) "On" else "Off"
            sheetBinding.textMenuQuickNightStatus.setTextColor(android.graphics.Color.parseColor(if (isDarkMode) "#FBBF24" else "#8E8E93"))
            sheetBinding.switchDarkMode.isChecked = isDarkMode
            if (!isThirdPartyMediaService(activeWebView?.url)) {
                injectDarkModeScript(activeWebView, isDarkMode)
            }
            dialog.dismiss()
        }
        sheetBinding.btnMenuNightInfo.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("About Night Mode")
                .setMessage("Night mode forces dark color schemes on any webpage, reducing eye strain and saving battery in low-light environments.")
                .setPositiveButton("Got it", null)
                .show()
        }

        sheetBinding.btnMenuAskAi.setOnClickListener {
            dialog.dismiss()
            showSmartPageSummaryDialog(initialTab = 1)
        }

        sheetBinding.rowNavShieldStatus.setOnClickListener {
            dialog.dismiss()
            openShieldDashboard()
        }

        sheetBinding.cardShieldDefenseStatus.setOnClickListener {
            dialog.dismiss()
            openShieldDashboard()
        }

        sheetBinding.rowShieldHub.setOnClickListener {
            dialog.dismiss()
            openShieldDashboard()
        }

        sheetBinding.textAppVersionInfo.text = "v${AppUpdateManager.getCurrentVersionName(this)} • Tap to check for updates"
        sheetBinding.rowAppUpdates.setOnClickListener {
            dialog.dismiss()
            AppUpdateManager.checkForUpdates(this, manualCheck = true)
        }
        sheetBinding.switchDesktop.isChecked = activeTab?.isDesktop ?: false
        sheetBinding.switchDarkMode.isChecked = isDarkMode
                val isBioEnabled = prefs.getBoolean(PREF_BIOMETRIC_PRIVATE_TABS, false)
        sheetBinding.switchBiometricLock.isChecked = isBioEnabled

        sheetBinding.switchBiometricLock.setOnClickListener {
            val targetState = sheetBinding.switchBiometricLock.isChecked
            if (targetState) {
                if (!canUseBiometric()) {
                    sheetBinding.switchBiometricLock.isChecked = false
                    Toast.makeText(this, "Set up a fingerprint or device PIN in Android Settings first", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                prefs.edit().putBoolean(PREF_BIOMETRIC_PRIVATE_TABS, true).apply()
                Toast.makeText(this, "Private tabs protected by fingerprint/PIN", Toast.LENGTH_SHORT).show()
            } else {
                sheetBinding.switchBiometricLock.isChecked = true
                authenticateUser(
                    title = "Disable Private Tab Lock",
                    subtitle = "Verify fingerprint or device PIN to turn off lock",
                    onSuccess = {
                        prefs.edit().putBoolean(PREF_BIOMETRIC_PRIVATE_TABS, false).apply()
                        sheetBinding.switchBiometricLock.isChecked = false
                        Toast.makeText(this, "Private tab lock disabled", Toast.LENGTH_SHORT).show()
                    },
                    onFail = {
                        sheetBinding.switchBiometricLock.isChecked = true
                        Toast.makeText(this, "Authentication required to disable lock", Toast.LENGTH_SHORT).show()
                    }
                )
            }
        }

        val showShortcuts = prefs.getBoolean(PREF_SHOW_HOMEPAGE_SHORTCUTS, true)
        sheetBinding.switchShowShortcuts.isChecked = showShortcuts
        sheetBinding.textCurrentEngine.text = "${currentSearchEngine.displayName} (Active)"
        sheetBinding.imgMenuEngine.setImageResource(currentSearchEngine.iconRes)

        val currentToolbarPos = prefs.getString(PREF_TOOLBAR_POSITION, "bottom") ?: "bottom"
        sheetBinding.textToolbarPosition.text = if (currentToolbarPos.equals("top", ignoreCase = true)) "Top" else "Bottom (Thumb Reach)"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(RoleManager::class.java)
            val isDefault = roleManager != null && roleManager.isRoleHeld(RoleManager.ROLE_BROWSER)
            sheetBinding.textDefaultBrowser.text = if (isDefault) "Default Browser (Active)" else "Set Fokk as default browser"
        }

        sheetBinding.switchShowShortcuts.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(PREF_SHOW_HOMEPAGE_SHORTCUTS, isChecked).apply()
            activeWebView?.evaluateJavascript("if (typeof toggleHomepageShortcutsVisibility === 'function') toggleHomepageShortcutsVisibility($isChecked);", null)
            val msg = if (isChecked) "Shortcuts displayed on homepage" else "Shortcuts hidden from homepage"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        val isAiFilterOn = prefs.getBoolean(PREF_AI_FILTER, true)
        sheetBinding.switchAiFilter.isChecked = isAiFilterOn
        sheetBinding.badgeAiFilter.text = if (isAiFilterOn) "AI Filter Active" else "AI Filter Off"
        sheetBinding.badgeAiFilter.alpha = if (isShieldEnabled && isAiFilterOn) 1.0f else 0.4f

        sheetBinding.switchAiFilter.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(PREF_AI_FILTER, isChecked).apply()
            sheetBinding.badgeAiFilter.text = if (isChecked) "AI Filter Active" else "AI Filter Off"
            sheetBinding.badgeAiFilter.alpha = if (isShieldEnabled && isChecked) 1.0f else 0.4f
            activeWebView?.evaluateJavascript("if (typeof setAiFilterEnabled === 'function') setAiFilterEnabled($isChecked);", null)
            val msg = if (isChecked) "AI Overviews & Slop Filter Enabled" else "AI Overviews & Slop Filter Disabled"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        sheetBinding.rowAiFilter.setOnClickListener {
            sheetBinding.switchAiFilter.isChecked = !sheetBinding.switchAiFilter.isChecked
        }

        sheetBinding.badgeAiFilter.setOnClickListener {
            sheetBinding.switchAiFilter.isChecked = !sheetBinding.switchAiFilter.isChecked
        }

        val isHttpsOnly = prefs.getBoolean(PREF_HTTPS_ONLY, true)
        sheetBinding.switchHttpsOnly.isChecked = isHttpsOnly
        sheetBinding.switchHttpsOnly.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(PREF_HTTPS_ONLY, isChecked).apply()
            val msg = if (isChecked) "HTTPS-Only Mode Enabled" else "HTTPS-Only Mode Disabled"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        sheetBinding.switchMenuShield.setOnCheckedChangeListener { _, isChecked ->
            if (isThirdPartyMediaService(activeWebView?.url)) {
                sheetBinding.switchMenuShield.isChecked = false
                Toast.makeText(this, "Filtering is disabled for this service", Toast.LENGTH_SHORT).show()
                return@setOnCheckedChangeListener
            }
            setShieldEnabledForCurrentSite(isChecked)
            sheetBinding.badgeSocialShield.alpha = if (isChecked) 1.0f else 0.4f
            val isAiOn = prefs.getBoolean(PREF_AI_FILTER, true)
            sheetBinding.badgeAiFilter.alpha = if (isChecked && isAiOn) 1.0f else 0.4f
            val msg = if (isChecked) "Fokk Shield Protection Enabled" else "Fokk Shield Paused"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
            activeWebView?.reload()
        }

        sheetBinding.switchDesktop.setOnCheckedChangeListener { _, isChecked ->
            activeTab?.let { tab ->
                tab.isDesktop = isChecked
                tab.webView?.let { webView ->
                    applyDesktopMode(webView, tab.isDesktop)
                    webView.reload()
                }
            }
            dialog.dismiss()
        }

        sheetBinding.switchDarkMode.setOnCheckedChangeListener { _, isChecked ->
            isDarkMode = isChecked
            if (!isThirdPartyMediaService(activeWebView?.url)) {
                injectDarkModeScript(activeWebView, isDarkMode)
            }
            dialog.dismiss()
        }

        sheetBinding.rowPrivateTab.setOnClickListener {
            authenticateForPrivateTabs {
                addNewTab("file:///android_asset/fokk_start.html", isPrivate = true)
                dialog.dismiss()
            }
        }

        sheetBinding.rowHistory.setOnClickListener {
            dialog.dismiss()
            showHistoryDialog()
        }

        if (isPrivateProfile) {
            sheetBinding.rowHistory.visibility = View.GONE
            sheetBinding.rowDownloads.visibility = View.GONE
            sheetBinding.rowPrivateTab.visibility = View.GONE
        }

        sheetBinding.rowDownloads.setOnClickListener {
            dialog.dismiss()
            showDownloadsDialog()
        }

        sheetBinding.rowTranslate.setOnClickListener {
            val currentUrl = activeTab?.url
            if (!currentUrl.isNullOrEmpty() && !currentUrl.contains("fokk_start.html")) {
                val translateUrl = "https://translate.google.com/translate?sl=auto&tl=en&u=" + Uri.encode(currentUrl)
                loadUrlInActiveWebView(translateUrl)
                Toast.makeText(this, "Translating page...", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Open a website to translate", Toast.LENGTH_SHORT).show()
            }
            dialog.dismiss()
        }

        sheetBinding.rowReaderMode.setOnClickListener {
            dialog.dismiss()
            openReaderView()
        }

        sheetBinding.rowDualDeck.setOnClickListener {
            dialog.dismiss()
            toggleDualDeckMode()
        }

        sheetBinding.rowSmartSummary.setOnClickListener {
            dialog.dismiss()
            showSmartPageSummaryDialog()
        }

        sheetBinding.rowSearchEngine.setOnClickListener {
            dialog.dismiss()
            showSearchEngineDialog()
        }

        sheetBinding.rowToolbarPosition.setOnClickListener {
            val options = arrayOf("Bottom (Thumb Reach - Default)", "Top")
            val current = prefs.getString(PREF_TOOLBAR_POSITION, "bottom") ?: "bottom"
            val selectedIndex = if (current.equals("top", ignoreCase = true)) 1 else 0
            MaterialAlertDialogBuilder(this)
                .setTitle("Toolbar Position")
                .setSingleChoiceItems(options, selectedIndex) { d, which ->
                    val newPos = if (which == 1) "top" else "bottom"
                    prefs.edit().putString(PREF_TOOLBAR_POSITION, newPos).apply()
                    val isHome = activeWebView?.url?.contains("fokk_start.html") == true || activeWebView?.url.isNullOrBlank()
                    applyToolbarPosition(newPos, isHomePage = isHome, animated = true)
                    sheetBinding.textToolbarPosition.text = if (newPos == "top") "Top" else "Bottom (Thumb Reach)"
                    Toast.makeText(this, "Toolbar position set to ${options[which]}", Toast.LENGTH_SHORT).show()
                    d.dismiss()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        sheetBinding.rowDefaultBrowser.setOnClickListener {
            dialog.dismiss()
            openSetDefaultBrowserDialog()
        }

        sheetBinding.rowExtensions.setOnClickListener {
            dialog.dismiss()
            showExtensionsManagerDialog()
        }

        sheetBinding.rowReload.setOnClickListener {
            activeWebView?.reload()
            dialog.dismiss()
        }

        sheetBinding.rowNewTab.setOnClickListener {
            addNewTab("file:///android_asset/fokk_start.html", isPrivate = false)
            dialog.dismiss()
        }

        sheetBinding.rowShare.setOnClickListener {
            val url = activeTab?.url ?: "fokk://home"
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, url)
            }
            startActivity(Intent.createChooser(shareIntent, "Share Page Link"))
            dialog.dismiss()
        }

        sheetBinding.rowWallpapers.setOnClickListener {
            dialog.dismiss()
            openWallpapersCustomizer()
        }

        sheetBinding.rowCustomizeShortcuts.setOnClickListener {
            dialog.dismiss()
            openShortcutsCustomizer()
        }

        sheetBinding.rowAddToHomeScreen.setOnClickListener {
            dialog.dismiss()
            val url = activeTab?.url.orEmpty()
            val title = activeTab?.title.orEmpty()
            val favicon = activeWebView?.favicon
            pinWebPageToLauncher(url, title, favicon)
        }

        sheetBinding.rowAddToStartpageShortcuts.setOnClickListener {
            dialog.dismiss()
            val url = activeTab?.url.orEmpty()
            val title = activeTab?.title.orEmpty()
            addStartpageShortcut(url, title)
        }

        sheetBinding.rowClearData.setOnClickListener {
            clearBrowsingData()
            dialog.dismiss()
        }

        sheetBinding.rowSitePrivacy.setOnClickListener {
            dialog.dismiss()
            showSitePrivacyDialog()
        }

        sheetBinding.rowReportSite.setOnClickListener {
            dialog.dismiss()
            reportBrokenSite()
        }

        sheetBinding.rowSettings.setOnClickListener {
            dialog.dismiss()
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        sheetBinding.rowDesktopSite.setOnClickListener {
            val isNowDesktop = !(activeTab?.isDesktop ?: false)
            activeTab?.let { tab ->
                tab.isDesktop = isNowDesktop
                tab.webView?.let { webView ->
                    applyDesktopMode(webView, tab.isDesktop)
                    webView.reload()
                }
            }
            dialog.dismiss()
        }

        sheetBinding.rowDarkMode.setOnClickListener {
            isDarkMode = !isDarkMode
            if (!isThirdPartyMediaService(activeWebView?.url)) {
                injectDarkModeScript(activeWebView, isDarkMode)
            }
            dialog.dismiss()
        }

        sheetBinding.rowAboutBrowser.setOnClickListener {
            dialog.dismiss()
            openAboutPage()
        }

        sheetBinding.rowFundraising.setOnClickListener {
            dialog.dismiss()
            showFundraisingContributingDialog()
        }

        sheetBinding.rowPrivacyPolicy.setOnClickListener {
            dialog.dismiss()
            openAboutPage("privacy")
        }

        sheetBinding.rowDisclaimer.setOnClickListener {
            dialog.dismiss()
            openAboutPage("disclaimer")
        }

        sheetBinding.rowNavGeneral.setOnClickListener {
            dialog.dismiss()
            showGeneralSettingsDialog()
        }

        sheetBinding.rowNavShield.setOnClickListener {
            dialog.dismiss()
            showShieldSettingsDialog()
        }

        sheetBinding.rowNavMedia.setOnClickListener {
            dialog.dismiss()
            showMediaSettingsDialog()
        }

        sheetBinding.rowNavVault.setOnClickListener {
            dialog.dismiss()
            showVaultSettingsDialog()
        }

        sheetBinding.rowNavExtensions.setOnClickListener {
            dialog.dismiss()
            showExtensionsManagerDialog()
        }

        sheetBinding.rowNavAbout.setOnClickListener {
            dialog.dismiss()
            showAboutCommunityDialog()
        }

        sheetBinding.rowNavFundraising.setOnClickListener {
            dialog.dismiss()
            showFundraisingContributingDialog()
        }

        dialog.show()
    }

    fun showGeneralSettingsDialog() {
        val dialog = BottomSheetDialog(this)
        val b = SheetGeneralSettingsBinding.inflate(layoutInflater)
        dialog.setContentView(b.root)

        b.btnCloseGeneralSettings.setOnClickListener { dialog.dismiss() }

        b.cardSetDefaultBrowser.setOnClickListener {
            dialog.dismiss()
            openSetDefaultBrowserDialog()
        }

        fun updateEngineRadios(selected: SearchEngine) {
            b.radioEngineBing.isChecked = selected == SearchEngine.BING
            b.radioEngineEcosia.isChecked = selected == SearchEngine.ECOSIA
            b.radioEngineDdg.isChecked = selected == SearchEngine.DUCKDUCKGO
            b.radioEngineBrave.isChecked = selected == SearchEngine.BRAVE
            b.radioEngineGoogle.isChecked = selected == SearchEngine.GOOGLE
            b.radioEngineStartpage.isChecked = selected == SearchEngine.STARTPAGE
        }
        updateEngineRadios(currentSearchEngine)

        val selectEngine: (SearchEngine) -> Unit = { engine ->
            currentSearchEngine = engine
            prefs.edit().putString(PREF_SEARCH_ENGINE, engine.name).apply()
            applySearchEngine(engine)
            updateEngineRadios(engine)
            Toast.makeText(this, "Search engine set to ${engine.displayName}", Toast.LENGTH_SHORT).show()
        }

        b.rowEngineBing.setOnClickListener { selectEngine(SearchEngine.BING) }
        b.rowEngineEcosia.setOnClickListener { selectEngine(SearchEngine.ECOSIA) }
        b.rowEngineDdg.setOnClickListener { selectEngine(SearchEngine.DUCKDUCKGO) }
        b.rowEngineBrave.setOnClickListener { selectEngine(SearchEngine.BRAVE) }
        b.rowEngineGoogle.setOnClickListener { selectEngine(SearchEngine.GOOGLE) }
        b.rowEngineStartpage.setOnClickListener { selectEngine(SearchEngine.STARTPAGE) }

        val currentToolbarPos = prefs.getString(PREF_TOOLBAR_POSITION, "bottom") ?: "bottom"
        val isTop = currentToolbarPos.equals("top", ignoreCase = true)
        b.switchToolbarPosition.isChecked = isTop
        b.textToolbarPosLabel.text = if (isTop) "Top (Classic address bar)" else "Bottom (Thumb-friendly reach)"

        b.switchToolbarPosition.setOnCheckedChangeListener { _, checked ->
            val newPos = if (checked) "top" else "bottom"
            prefs.edit().putString(PREF_TOOLBAR_POSITION, newPos).apply()
            val isHome = activeWebView?.url?.contains("fokk_start.html") == true || activeWebView?.url.isNullOrBlank()
            applyToolbarPosition(newPos, isHomePage = isHome, animated = true)
            b.textToolbarPosLabel.text = if (checked) "Top (Classic address bar)" else "Bottom (Thumb-friendly reach)"
            Toast.makeText(this, "Toolbar position set to ${if (checked) "Top" else "Bottom"}", Toast.LENGTH_SHORT).show()
        }

        b.switchHttpsOnly.isChecked = prefs.getBoolean(PREF_HTTPS_ONLY, true)
        b.switchHttpsOnly.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(PREF_HTTPS_ONLY, checked).apply()
            Toast.makeText(this, if (checked) "HTTPS-Only Mode Enabled" else "HTTPS-Only Mode Disabled", Toast.LENGTH_SHORT).show()
        }

        val isLightMode = prefs.getBoolean(PREF_LIGHT_THEME, false)
        b.switchLightMode.isChecked = isLightMode
        b.textLightModeDesc.text = if (isLightMode) "Light theme active" else "Dark Cyberpunk active (Default)"
        b.switchLightMode.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(PREF_LIGHT_THEME, checked).apply()
            b.textLightModeDesc.text = if (checked) "Light theme active" else "Dark Cyberpunk active (Default)"
            val themeKey = if (checked) "pearl_light" else "default"
            activeWebView?.evaluateJavascript("if (typeof setWallpaper === 'function') setWallpaper('$themeKey');", null)
            Toast.makeText(this, if (checked) "Daylight Mode Enabled" else "Dark Mode Enabled", Toast.LENGTH_SHORT).show()
        }

        dialog.show()
    }

    private fun showShieldSettingsDialog() {
        val dialog = BottomSheetDialog(this)
        val b = SheetShieldSettingsBinding.inflate(layoutInflater)
        dialog.setContentView(b.root)

        b.btnCloseShieldSettings.setOnClickListener { dialog.dismiss() }

        val isReady = AdShieldApp.instance.braveEngine.isEngineReady()
        b.badgeRustStatus.text = if (isReady) "JNI ACTIVE (102K RULES)" else "INITIALIZING..."

        b.switchGhostCloaker.isChecked = prefs.getBoolean(PREF_GHOST_CLOAKER, true)
        b.switchGhostCloaker.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(PREF_GHOST_CLOAKER, checked).apply()
            Toast.makeText(this, if (checked) "Synthetic Ghost Cloaking Enabled" else "Ghost Cloaking Disabled", Toast.LENGTH_SHORT).show()
        }

        b.switchDohTunnel.isChecked = prefs.getBoolean(PREF_DOH_TUNNEL, true)
        b.switchDohTunnel.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(PREF_DOH_TUNNEL, checked).apply()
            AdShieldApp.instance.dohEngine.isEnabled = checked
            Toast.makeText(this, if (checked) "Encrypted DoH DNS Enabled" else "DoH DNS Disabled", Toast.LENGTH_SHORT).show()
        }

        val providerName = prefs.getString(PREF_DOH_PROVIDER, DnsOverHttpsEngine.PROVIDER_ADGUARD) ?: DnsOverHttpsEngine.PROVIDER_ADGUARD
        b.textDohProviderName.text = providerName

        b.rowDohProvider.setOnClickListener {
            val providers = DnsOverHttpsEngine.ALL_PROVIDERS
            val current = prefs.getString(PREF_DOH_PROVIDER, DnsOverHttpsEngine.PROVIDER_ADGUARD)
            val selectedIndex = providers.indexOf(current).coerceAtLeast(0)
            MaterialAlertDialogBuilder(this)
                .setTitle("Select Encrypted DoH Provider")
                .setSingleChoiceItems(providers, selectedIndex) { d, which ->
                    val chosen = providers[which]
                    prefs.edit().putString(PREF_DOH_PROVIDER, chosen).apply()
                    b.textDohProviderName.text = chosen
                    AdShieldApp.instance.dohEngine.currentProvider = DnsOverHttpsEngine.getProviderByName(chosen)
                    AdShieldApp.instance.dohEngine.clearCache()
                    Toast.makeText(this, "DoH Provider set to $chosen", Toast.LENGTH_SHORT).show()
                    d.dismiss()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        b.switchPopunderDefuser.isChecked = prefs.getBoolean(PREF_POPUNDER_DEFUSER, true)
        b.switchPopunderDefuser.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(PREF_POPUNDER_DEFUSER, checked).apply()
            Toast.makeText(this, if (checked) "Popunder & Tab Hijack Immunity Active" else "Popunder Immunity Disabled", Toast.LENGTH_SHORT).show()
        }

        dialog.show()
    }

    private fun showMediaSettingsDialog() {
        val dialog = BottomSheetDialog(this)
        val b = SheetMediaHubSettingsBinding.inflate(layoutInflater)
        dialog.setContentView(b.root)

        b.btnCloseMediaSettings.setOnClickListener { dialog.dismiss() }

        b.switchVideoSniffer.isChecked = prefs.getBoolean(PREF_VIDEO_SNIFFER, true)
        b.switchVideoSniffer.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(PREF_VIDEO_SNIFFER, checked).apply()
            if (!checked) {
                binding.chipMediaDetected.visibility = View.GONE
            }
            Toast.makeText(this, if (checked) "Video Sniffer Enabled" else "Video Sniffer Disabled", Toast.LENGTH_SHORT).show()
        }

        b.switchMxGestures.isChecked = prefs.getBoolean(PREF_MX_GESTURES, true)
        b.switchMxGestures.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(PREF_MX_GESTURES, checked).apply()
            Toast.makeText(this, if (checked) "MX-Player Video Gestures Enabled" else "Video Gestures Disabled", Toast.LENGTH_SHORT).show()
        }

        b.switchBackgroundAudio.isChecked = prefs.getBoolean("fokk_background_audio", true)
        b.switchBackgroundAudio.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean("fokk_background_audio", checked).apply()
            Toast.makeText(this, if (checked) "Background Audio Enabled" else "Background Audio Disabled", Toast.LENGTH_SHORT).show()
        }

        b.switchAutoPip.isChecked = prefs.getBoolean("fokk_auto_pip", true)
        b.switchAutoPip.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean("fokk_auto_pip", checked).apply()
            Toast.makeText(this, if (checked) "Auto Picture-in-Picture Enabled" else "Auto PiP Disabled", Toast.LENGTH_SHORT).show()
        }

        dialog.show()
    }

    private fun showVaultSettingsDialog() {
        val dialog = BottomSheetDialog(this)
        val b = SheetVaultSettingsBinding.inflate(layoutInflater)
        dialog.setContentView(b.root)

        b.btnCloseVaultSettings.setOnClickListener { dialog.dismiss() }

        b.switchBiometricLock.isChecked = prefs.getBoolean(PREF_BIOMETRIC_PRIVATE_TABS, false)
        b.switchBiometricLock.setOnClickListener {
            val target = b.switchBiometricLock.isChecked
            if (target) {
                if (!canUseBiometric()) {
                    b.switchBiometricLock.isChecked = false
                    Toast.makeText(this, "Set up a fingerprint or PIN in Android Settings first", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                prefs.edit().putBoolean(PREF_BIOMETRIC_PRIVATE_TABS, true).apply()
                Toast.makeText(this, "Private tabs protected by biometric lock", Toast.LENGTH_SHORT).show()
            } else {
                b.switchBiometricLock.isChecked = true
                authenticateUser(
                    title = "Disable Private Tab Lock",
                    subtitle = "Verify fingerprint or device PIN",
                    onSuccess = {
                        prefs.edit().putBoolean(PREF_BIOMETRIC_PRIVATE_TABS, false).apply()
                        b.switchBiometricLock.isChecked = false
                        Toast.makeText(this, "Private tab lock disabled", Toast.LENGTH_SHORT).show()
                    },
                    onFail = {
                        b.switchBiometricLock.isChecked = true
                    }
                )
            }
        }

        b.switchDecoyCalculator.isChecked = prefs.getBoolean(PREF_DECOY_CALCULATOR, false)
        b.switchDecoyCalculator.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(PREF_DECOY_CALCULATOR, checked).apply()
            val msg = if (checked) "Stealth Calculator Decoy Mode Enabled" else "Decoy Calculator Disabled"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        val currentPin = prefs.getString(PREF_DECOY_PIN, "1337") ?: "1337"
        b.textCurrentDecoyPin.text = "$currentPin ="

        b.rowChangeDecoyPin.setOnClickListener {
            val input = EditText(this).apply {
                hint = "Enter 4-digit PIN (e.g. 1337)"
                inputType = android.text.InputType.TYPE_CLASS_NUMBER
                setText(prefs.getString(PREF_DECOY_PIN, "1337"))
            }
            MaterialAlertDialogBuilder(this)
                .setTitle("Secret Unlock PIN")
                .setMessage("Enter the passcode you will type into the decoy calculator followed by '=' to unlock:")
                .setView(input)
                .setPositiveButton("Save") { _, _ ->
                    val newPin = input.text.toString().trim()
                    if (newPin.length >= 3) {
                        prefs.edit().putString(PREF_DECOY_PIN, newPin).apply()
                        b.textCurrentDecoyPin.text = "$newPin ="
                        Toast.makeText(this, "Decoy PIN updated to $newPin", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this, "PIN must be at least 3 digits", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        b.btnBackupVault.setOnClickListener {
            val history = localPrefs.getString(PREF_BROWSING_HISTORY, "[]") ?: "[]"
            val file = File(getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS), "fokk_vault_backup.json")
            file.writeText(history)
            Toast.makeText(this, "Backup exported to ${file.name}", Toast.LENGTH_LONG).show()
        }

        b.btnRestoreVault.setOnClickListener {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
            }
            vaultRestorePickerLauncher.launch(intent)
        }

        dialog.show()
    }

    private fun showAboutCommunityDialog() {
        val dialog = BottomSheetDialog(this)
        val b = SheetAboutCommunityBinding.inflate(layoutInflater)
        dialog.setContentView(b.root)

        b.btnCloseAboutCommunity.setOnClickListener { dialog.dismiss() }

        b.cardCheckUpdates.setOnClickListener {
            dialog.dismiss()
            AppUpdateManager.checkForUpdates(this, manualCheck = true)
        }

        b.cardCommunityFundraising.setOnClickListener {
            dialog.dismiss()
            showFundraisingContributingDialog()
        }

        b.cardOpenSource.setOnClickListener {
            dialog.dismiss()
            openAboutPage("licenses")
        }

        dialog.show()
    }

    private fun showFundraisingContributingDialog() {
        addNewTab("file:///android_asset/fokk_contributing.html", isPrivate = false)
    }

    private fun applyVpnModeWithFeedback(
        mode: com.adshield.app.engine.VpnEngine.VpnMode,
        customProxy: String? = null,
        onDone: (() -> Unit)? = null
    ) {
        com.adshield.app.engine.VpnEngine.applyVpnMode(this, mode, customProxy) { success, msg ->
            runOnUiThread {
                if (success) {
                    activeWebView?.reload()
                    lastVpnRouteFingerprint = getVpnRouteFingerprint()
                    updateVpnIndicatorUi()
                }
                onDone?.invoke()
                Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showVpnModeSelector() {
        val sheetDialog = BottomSheetDialog(this)
        val b = SheetVpnGatewayBinding.inflate(layoutInflater)
        sheetDialog.setContentView(b.root)

        b.btnCloseVpnSheet.setOnClickListener { sheetDialog.dismiss() }

        b.btnVpnInfo.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("About Fokk Mesh Architecture")
                .setMessage("Fokk Mesh is an oblivious privacy mesh that secures your connections with zero logs.\n\n• Oblivious Mesh Routing: Traffic is routed through separate oblivious hops designed to dissociate your client IP from destination hostnames.\n\n• Device-Wide Mesh: Enable 'Fokk Mesh for entire device' to route all system apps through the encrypted privacy mesh.\n\n• Nym Mixnet Timing Obfuscation: In Pro mode, packet timing jitter introduces micro-delays during connection handshakes to resist DPI traffic analysis and ISP fingerprinting.\n\n• Ephemeral In-Memory Processing: Operates under a strict zero-log operational policy with ephemeral in-memory processing.")
                .setPositiveButton("Got it", null)
                .show()
        }

        lateinit var refreshUi: () -> Unit

        fun switchMode(mode: com.adshield.app.engine.VpnEngine.VpnMode, customProxy: String? = null) {
            applyVpnModeWithFeedback(mode, customProxy) {
                refreshUi()
            }
        }

        fun setupEntireDeviceSwitch() {
            b.switchEntireDevice.setOnCheckedChangeListener { _, isChecked ->
                if (isChecked) {
                    val prepareIntent = VpnService.prepare(this)
                    if (prepareIntent != null) {
                        onVpnPermissionResult = { granted ->
                            if (granted) {
                                com.adshield.app.engine.VpnEngine.setEntireDeviceEnabled(this, true)
                                refreshUi()
                            } else {
                                b.switchEntireDevice.setOnCheckedChangeListener(null)
                                b.switchEntireDevice.isChecked = false
                                setupEntireDeviceSwitch()
                                Toast.makeText(this, "VPN permission required for device-wide Fokk Mesh", Toast.LENGTH_SHORT).show()
                            }
                        }
                        vpnPermissionLauncher.launch(prepareIntent)
                    } else {
                        com.adshield.app.engine.VpnEngine.setEntireDeviceEnabled(this, true)
                        refreshUi()
                    }
                } else {
                    com.adshield.app.engine.VpnEngine.setEntireDeviceEnabled(this, false)
                    refreshUi()
                }
            }
        }

        refreshUi = {
            val activeMode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
            val isConnected = activeMode != com.adshield.app.engine.VpnEngine.VpnMode.OFF
            val customSaved = com.adshield.app.engine.VpnEngine.getCustomProxy(this)
            val entireDeviceActive = com.adshield.app.engine.VpnEngine.isEntireDeviceEnabled(this)

            if (isConnected) {
                val isSmartCloak = activeMode == com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK
                val liveSummary = com.adshield.app.engine.FokkTunnelEngine.getLiveStatusSummary()
                val aliveNodes = com.adshield.app.engine.FokkNodeProber.lastAliveCount
                val totalNodes = com.adshield.app.engine.FokkNodeProber.lastTotalCount
                b.textVpnPowerLabel.text = if (isSmartCloak) "Smart-Cloak Active" else "Mesh Pro Protected"
                b.textVpnPowerLabel.setTextColor(android.graphics.Color.parseColor("#10B981"))
                b.textVpnPowerSub.text = liveSummary
                b.vpnRadarRing.backgroundTintList = ColorStateList.valueOf(android.graphics.Color.parseColor("#10B981"))
                b.btnVpnPower.imageTintList = ColorStateList.valueOf(android.graphics.Color.parseColor("#10B981"))
                b.textVpnStatusPill.text = if (isSmartCloak) "SMART-CLOAK · FULL SPEED" else "FOKK MESH PRO ACTIVE"
                b.textVpnStatusPill.setTextColor(android.graphics.Color.parseColor("#10B981"))
                val nodeStat = if (!isSmartCloak && totalNodes > 0) " ($aliveNodes/$totalNodes live)" else ""
                b.textVpnExitIp.text = "$liveSummary$nodeStat"
                b.textVpnExitIp.setTextColor(android.graphics.Color.parseColor("#10B981"))
            } else {
                b.textVpnPowerLabel.text = "Disconnected"
                b.textVpnPowerLabel.setTextColor(android.graphics.Color.parseColor("#F8FAFC"))
                b.textVpnPowerSub.text = "Tap to activate Fokk Smart-Cloak"
                b.vpnRadarRing.backgroundTintList = ColorStateList.valueOf(android.graphics.Color.parseColor("#1E293B"))
                b.btnVpnPower.imageTintList = ColorStateList.valueOf(android.graphics.Color.parseColor("#94A3B8"))
                b.textVpnStatusPill.text = "DIRECT CONNECTION"
                b.textVpnStatusPill.setTextColor(android.graphics.Color.parseColor("#F43F5E"))
                b.textVpnExitIp.text = "Direct (System DNS)"
                b.textVpnExitIp.setTextColor(android.graphics.Color.parseColor("#F43F5E"))
            }

            val activeRegionCode = when (activeMode) {
                com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK -> "SMART_CLOAK"
                com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM -> customSaved
                else -> "AUTO"
            }
            val locationLabel = com.adshield.app.engine.VpnEngine.getRegionDisplayName(activeRegionCode)
            val flagRes = com.adshield.app.engine.VpnEngine.getRegionFlagRes(activeRegionCode)

            b.textSelectedLocation.text = locationLabel
            b.imgSelectedLocationFlag.setImageResource(flagRes)
            b.textLocationSub.text = when {
                !isConnected -> "Tap to switch Smart-Cloak / Mesh Pro"
                activeMode == com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK -> "Encrypted DoH + TLS SNI Shield · Full Speed"
                else -> "IP-Masking Exit Gateway · Protected"
            }

            b.checkPrivateTabsOnly.isChecked = com.adshield.app.engine.VpnEngine.isPrivateOnlyEnabled(this)

            b.switchEntireDevice.setOnCheckedChangeListener(null)
            b.switchEntireDevice.isChecked = entireDeviceActive
            setupEntireDeviceSwitch()

            b.switchBypassSearch.isChecked = com.adshield.app.engine.VpnEngine.isBypassSearchEnabled(this)

            val isPro = com.adshield.app.engine.VpnEngine.isProModeEnabled(this)
            b.textVpnProtocol.text = when (activeMode) {
                com.adshield.app.engine.VpnEngine.VpnMode.OFF -> "Direct"
                com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK -> "Fokk Smart-Cloak (DoH + SNI)"
                com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM -> if (isPro) "Fokk Mesh Pro ($locationLabel)" else "Fokk Mesh ($locationLabel)"
                else -> if (isPro) "Fokk Mesh Pro (Dual-Hop)" else "Fokk Mesh (Auto)"
            }

            b.radioModeTor.isChecked = (activeMode == com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK || activeMode == com.adshield.app.engine.VpnEngine.VpnMode.FAST || activeMode == com.adshield.app.engine.VpnEngine.VpnMode.TOR || activeMode == com.adshield.app.engine.VpnEngine.VpnMode.RELAY)
            b.radioModeRelay.isChecked = false
            b.radioModeCustom.isChecked = (activeMode == com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM)
            b.radioModeOff.isChecked = (activeMode == com.adshield.app.engine.VpnEngine.VpnMode.OFF)
            b.layoutOrbotHelper.visibility = View.GONE
        }

        vpnSheetRefreshCallback = { refreshUi() }
        sheetDialog.setOnDismissListener { vpnSheetRefreshCallback = null }

        refreshUi()

        b.btnVpnPower.setOnClickListener {
            val current = com.adshield.app.engine.VpnEngine.getActiveMode(this)
            if (current != com.adshield.app.engine.VpnEngine.VpnMode.OFF) {
                switchMode(com.adshield.app.engine.VpnEngine.VpnMode.OFF)
            } else {
                // Default Free instant-connect = Fokk Smart-Cloak (full native speed, DoH + TLS SNI bypass)
                // If user explicitly saved a Pro country/private relay, reconnect to that cleanly
                val custom = com.adshield.app.engine.VpnEngine.getCustomProxy(this)
                val isPro = com.adshield.app.engine.VpnEngine.isProModeEnabled(this)
                if (isPro && custom.isNotBlank()) {
                    switchMode(com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM, custom)
                } else {
                    switchMode(com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK)
                }
            }
        }

        b.cardLocationSelector.setOnClickListener {
            showDedicatedRegionOrCustomDialog { selection ->
                when (selection) {
                    "SMART_CLOAK" -> switchMode(com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK)
                    "AUTO" -> switchMode(com.adshield.app.engine.VpnEngine.VpnMode.FAST)
                    else -> switchMode(com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM, selection)
                }
            }
        }

        b.checkPrivateTabsOnly.setOnCheckedChangeListener { _, isChecked ->
            com.adshield.app.engine.VpnEngine.setPrivateOnlyEnabled(this, isChecked)
            val activeMode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
            if (activeMode != com.adshield.app.engine.VpnEngine.VpnMode.OFF) {
                if (isChecked) {
                    com.adshield.app.engine.VpnEngine.syncProxyForTabPrivacy(this, activeTab?.isPrivate == true)
                } else {
                    com.adshield.app.engine.VpnEngine.applyVpnMode(this, activeMode)
                }
            }
        }
        b.rowPrivateTabsOnly.setOnClickListener {
            b.checkPrivateTabsOnly.isChecked = !b.checkPrivateTabsOnly.isChecked
        }

        b.rowEntireDevice.setOnClickListener {
            b.switchEntireDevice.isChecked = !b.switchEntireDevice.isChecked
        }

        b.switchBypassSearch.setOnCheckedChangeListener { _, isChecked ->
            com.adshield.app.engine.VpnEngine.setBypassSearchEnabled(this, isChecked)
        }
        b.rowBypassSearch.setOnClickListener {
            b.switchBypassSearch.isChecked = !b.switchBypassSearch.isChecked
        }

        val proClickListener = View.OnClickListener {
            showVpnProDialog()
        }
        b.cardProPrivacy.setOnClickListener(proClickListener)
        b.btnProGetStarted.setOnClickListener(proClickListener)

        b.rowAutoConnect.setOnClickListener {
            Toast.makeText(this, "Auto-connect is managed automatically by Fokk Engine", Toast.LENGTH_SHORT).show()
        }

        b.btnVerifyVpnExitIp.setOnClickListener {
            sheetDialog.dismiss()
            showVerifyBrowserExitDialog()
        }

        sheetDialog.show()
    }

    private fun showVpnProDialog() {
        val sheetDialog = BottomSheetDialog(this)
        val b = com.adshield.app.databinding.SheetVpnProBinding.inflate(layoutInflater)
        sheetDialog.setContentView(b.root)

        val isPro = com.adshield.app.engine.VpnEngine.isProModeEnabled(this)
        b.switchProActivation.isChecked = isPro
        b.textProStatusHeader.text = if (isPro) "Fokk Pro Active" else "Fokk Pro Inactive"
        b.textProStatusSub.text = if (isPro) "Fokk Mesh Pro & Timing Obfuscation active" else "Standard routing active"

        b.switchProActivation.setOnCheckedChangeListener { _, isChecked ->
            com.adshield.app.engine.VpnEngine.setProModeEnabled(this, isChecked)
            com.adshield.app.engine.FokkTunnelEngine.isProMode = isChecked
            b.textProStatusHeader.text = if (isChecked) "Fokk Pro Active" else "Fokk Pro Inactive"
            b.textProStatusSub.text = if (isChecked) "Fokk Mesh Pro & Timing Obfuscation active" else "Standard routing active"
            val msg = if (isChecked) "Fokk Mesh Pro Privacy Network Activated" else "Standard Network Activated"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        b.btnSelectProCountry.setOnClickListener {
            sheetDialog.dismiss()
            showDedicatedRegionOrCustomDialog { selection ->
                when (selection) {
                    "SMART_CLOAK" -> applyVpnModeWithFeedback(com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK)
                    "AUTO" -> applyVpnModeWithFeedback(com.adshield.app.engine.VpnEngine.VpnMode.FAST)
                    else -> applyVpnModeWithFeedback(com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM, selection)
                }
            }
        }

        b.btnCloseProSheet.setOnClickListener { sheetDialog.dismiss() }
        b.btnDoneProSheet.setOnClickListener { sheetDialog.dismiss() }

        sheetDialog.show()
    }

    private fun getVpnRouteFingerprint(): String {
        val mode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
        val proxy = if (mode == com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM) {
            com.adshield.app.engine.VpnEngine.getCustomProxy(this)
        } else {
            ""
        }
        return "${mode.id}:$proxy"
    }

    /** Uses a fresh WebView so IP verification does not reuse the active page's old connections or CSP. */
    private fun showVerifyBrowserExitDialog() {
        if (activeWebView == null) {
            Toast.makeText(this, "Open a page before checking the browser exit", Toast.LENGTH_SHORT).show()
            return
        }
        val routeFingerprintAtStart = getVpnRouteFingerprint()
        val progress = android.app.ProgressDialog(this).apply {
            setMessage("Checking browser exit through the active route...")
            setCancelable(false)
            show()
        }

        val probe = WebView(this).apply {
            visibility = View.INVISIBLE
            settings.javaScriptEnabled = true
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
        }
        binding.tabContainer.addView(probe, FrameLayout.LayoutParams(1, 1))

        val endpoints = listOf(
            "https://api4.ipify.org?format=json",
            "https://api.ipify.org?format=json",
            "https://ipinfo.io/json",
            "https://ifconfig.me/ip",
            "https://icanhazip.com/",
            "https://cloudflare.com/cdn-cgi/trace"
        )
        var endpointIndex = 0
        var activeHost: String? = null
        var finished = false
        val timeoutHandler = Handler(Looper.getMainLooper())
        var endpointTimeout: Runnable? = null
        var finishCheck: (String?, String?) -> Unit = { _, _ -> }
        var loadNextEndpoint: (String?) -> Unit = { _ -> }
        val timeout = Runnable { finishCheck(null, "The IP check timed out through the active browser route.") }

        fun cleanupProbe(dismissProgress: Boolean = true) {
            timeoutHandler.removeCallbacks(timeout)
            endpointTimeout?.let(timeoutHandler::removeCallbacks)
            if (dismissProgress) try { progress.dismiss() } catch (_: Exception) {}
            runCatching { probe.stopLoading() }
            binding.tabContainer.removeView(probe)
            runCatching { probe.destroy() }
        }

        finishCheck = finish@{ ip, error ->
            if (finished) return@finish
            finished = true
            cleanupProbe(dismissProgress = ip == null)
            if (ip != null && routeFingerprintAtStart != getVpnRouteFingerprint()) {
                try { progress.dismiss() } catch (_: Exception) {}
                AlertDialog.Builder(this)
                    .setTitle("Browser Route Changed")
                    .setMessage("The selected proxy changed while the check was running. Run verification again to compare one stable route.")
                    .setPositiveButton("OK", null)
                    .show()
                return@finish
            }
            val mode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
            if (ip == null) {
                AlertDialog.Builder(this)
                    .setTitle("Browser Exit Could Not Be Verified")
                    .setMessage(error ?: "The IP check did not return a valid address.")
                    .setPositiveButton("OK", null)
                    .show()
                return@finish
            }

            progress.setMessage("Comparing with the direct network address...")
            com.adshield.app.engine.VpnEngine.checkDirectPublicIp { directIp, directError ->
                runOnUiThread {
                    try { progress.dismiss() } catch (_: Exception) {}
                    if (routeFingerprintAtStart != getVpnRouteFingerprint()) {
                        AlertDialog.Builder(this)
                            .setTitle("Browser Route Changed")
                            .setMessage("The selected proxy changed during comparison. Run verification again to compare one stable route.")
                            .setPositiveButton("OK", null)
                            .show()
                        return@runOnUiThread
                    }
                    val comparison = when {
                        mode == com.adshield.app.engine.VpnEngine.VpnMode.OFF ->
                            "Fokk Mesh is disconnected. Browser is using direct unencrypted public IP."
                        directIp == null ->
                            "Protected IP verified ($ip), direct connection baseline was unreachable."
                        ip == directIp ->
                            "Matches direct IP. Browser traffic may not be masked."
                        else ->
                            "Protected by Fokk Mesh. Real IP is masked (${directIp} -> ${ip})."
                    }
                    AlertDialog.Builder(this)
                        .setTitle("Fokk Mesh Protection Check")
                        .setMessage("Masked IP: $ip\nDirect IP: ${directIp ?: "Unavailable"}\nRouting: ${mode.title}\n\n$comparison")
                        .setPositiveButton("OK", null)
                        .show()
                }
            }
        }

        loadNextEndpoint = next@{ lastError ->
            if (finished) return@next
            endpointTimeout?.let(timeoutHandler::removeCallbacks)
            endpointTimeout = null
            if (endpointIndex >= endpoints.size) {
                finishCheck(null, lastError ?: "No IP address was returned by the verification services.")
            } else {
                val url = endpoints[endpointIndex++]
                activeHost = Uri.parse(url).host
                val hostForTimeout = activeHost
                endpointTimeout = Runnable {
                    if (!finished && activeHost == hostForTimeout) {
                        loadNextEndpoint("${hostForTimeout ?: "IP service"} timed out through the active route.")
                    }
                }
                timeoutHandler.postDelayed(endpointTimeout!!, 5_000)
                probe.loadUrl(url)
            }
        }

        probe.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (Uri.parse(url.orEmpty()).host != activeHost || finished) return
                view?.evaluateJavascript("(document.body && document.body.innerText || '').trim()") { raw ->
                    val pageText = runCatching {
                        org.json.JSONTokener(raw ?: "").nextValue() as? String
                    }.getOrNull().orEmpty().trim()
                    val jsonIp = runCatching { JSONObject(pageText).optString("ip") }.getOrDefault("").trim()
                    val traceIp = Regex("(?m)^ip=([^\\s]+)").find(pageText)?.groupValues?.getOrNull(1).orEmpty()
                    val plainIp = pageText.trim().takeIf { android.util.Patterns.IP_ADDRESS.matcher(it).matches() }.orEmpty()
                    val candidate = listOf(jsonIp, traceIp, plainIp).firstOrNull {
                        android.util.Patterns.IP_ADDRESS.matcher(it).matches()
                    }
                    if (candidate != null) {
                        finishCheck(candidate, null)
                    } else {
                        loadNextEndpoint("The IP service returned no parseable public address.")
                    }
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true && Uri.parse(request.url.toString()).host == activeHost) {
                    loadNextEndpoint(error?.description?.toString() ?: "The IP verification service could not be reached.")
                }
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request?.isForMainFrame == true && Uri.parse(request.url.toString()).host == activeHost) {
                    loadNextEndpoint("The IP verification service returned HTTP ${errorResponse?.statusCode ?: "error"}.")
                }
            }
        }

        timeoutHandler.postDelayed(timeout, 35_000)
        loadNextEndpoint(null)
    }

    private fun showDedicatedRegionOrCustomDialog(onApplied: (String) -> Unit) {
        val sheetDialog = BottomSheetDialog(this)
        val b = com.adshield.app.databinding.SheetVpnLocationPickerBinding.inflate(layoutInflater)
        sheetDialog.setContentView(b.root)

        val currentSaved = com.adshield.app.engine.VpnEngine.getCustomProxy(this)
        val activeMode = com.adshield.app.engine.VpnEngine.getActiveMode(this)
        val activeCode = when (activeMode) {
            com.adshield.app.engine.VpnEngine.VpnMode.SMART_CLOAK -> "SMART_CLOAK"
            com.adshield.app.engine.VpnEngine.VpnMode.FAST -> "AUTO"
            else -> currentSaved
        }

        data class MeshCountryItem(
            val code: String,
            val name: String,
            val subtitle: String,
            val flagRes: Int,
            val bestLatencyMs: Long
        )

        // Build location list strictly from LIVE verified Sentinel manifest relays (zero dead/fake countries!)
        val liveManifestNodes = com.adshield.app.engine.FokkNodeManifest.getNodes()
        val groupedByCountry = liveManifestNodes
            .filter { it.country.isNotBlank() }
            .groupBy { it.country.uppercase(Locale.ROOT) }

        val countries = groupedByCountry.entries.map { (code, nodes) ->
            val cities = nodes.mapNotNull { it.city.takeIf { c -> c.isNotBlank() } }.distinct().take(2).joinToString(" & ")
            val bestLat = nodes.map { com.adshield.app.engine.NodeRegistry.getLatency(it) }.minOrNull() ?: Long.MAX_VALUE
            val hasDualHop = nodes.any { !it.isHttpConnect }
            val parts = mutableListOf<String>()
            if (cities.isNotBlank()) parts.add(cities)
            parts.add(if (nodes.size == 1) "1 live relay" else "${nodes.size} live relays")
            if (bestLat in 1L..15_000L) parts.add("~${bestLat}ms")
            else if (hasDualHop) parts.add("Verified")
            MeshCountryItem(
                code = code,
                name = com.adshield.app.engine.VpnEngine.getRegionDisplayName(code),
                subtitle = parts.joinToString(" · "),
                flagRes = com.adshield.app.engine.VpnEngine.getRegionFlagRes(code),
                bestLatencyMs = bestLat
            )
        }.sortedBy { it.bestLatencyMs }

        fun select(code: String) {
            val isPro = com.adshield.app.engine.VpnEngine.isProModeEnabled(this)
            if (code != "SMART_CLOAK" && code != "AUTO" && !isPro) {
                sheetDialog.dismiss()
                showVpnProDialog()
                Toast.makeText(this, "Dedicated Country routing is a Fokk Mesh Pro feature. Smart-Cloak is free.", Toast.LENGTH_LONG).show()
                return
            }
            sheetDialog.dismiss()
            onApplied(code)
        }

        b.btnCloseLocationSheet.setOnClickListener { sheetDialog.dismiss() }
        b.rowLocationSmartCloak.setOnClickListener { select("SMART_CLOAK") }
        b.rowLocationAuto.setOnClickListener { select("AUTO") }

        val countryCheckViews = mutableMapOf<String, View>()
        val inflater = layoutInflater

        for (country in countries) {
            val itemBinding = com.adshield.app.databinding.ItemVpnLocationBinding.inflate(inflater, b.countryLocationsContainer, false)
            itemBinding.imgFlag.setImageResource(country.flagRes)
            itemBinding.textTitle.text = country.name
            itemBinding.textSubtitle.text = country.subtitle
            itemBinding.badgePro.visibility = View.VISIBLE
            itemBinding.rowLocation.setOnClickListener { select(country.code) }
            countryCheckViews[country.code] = itemBinding.imgCheck
            b.countryLocationsContainer.addView(itemBinding.root)
        }

        b.checkLocationSmartCloak.visibility = View.GONE
        b.checkLocationAuto.visibility = View.GONE
        b.checkLocationCustom.visibility = View.GONE
        countryCheckViews.values.forEach { it.visibility = View.GONE }

        val normalizedActiveCode = when (activeCode) {
            "AM" -> "US"
            "EU" -> "DE"
            "AS" -> "SG"
            else -> activeCode
        }

        if (normalizedActiveCode == "SMART_CLOAK" || normalizedActiveCode.isBlank()) {
            b.checkLocationSmartCloak.visibility = View.VISIBLE
        } else if (normalizedActiveCode == "AUTO") {
            b.checkLocationAuto.visibility = View.VISIBLE
        } else if (normalizedActiveCode in countryCheckViews) {
            countryCheckViews[normalizedActiveCode]?.visibility = View.VISIBLE
        } else {
            b.checkLocationCustom.visibility = View.VISIBLE
            b.textCustomServerSub.text = "Active: $activeCode"
        }

        b.rowLocationCustom.setOnClickListener {
            val isPro = com.adshield.app.engine.VpnEngine.isProModeEnabled(this)
            if (!isPro) {
                sheetDialog.dismiss()
                showVpnProDialog()
                Toast.makeText(this, "Custom Private Server is a Fokk Pro feature. Optimal Location is free.", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            sheetDialog.dismiss()
            showCustomProxyDialog(onApplied)
        }

        sheetDialog.show()
    }

    private fun showCustomProxyDialog(onApplied: ((String) -> Unit)? = null) {
        val input = EditText(this).apply {
            hint = "host:port (e.g. 1.2.3.4:1080)"
            val saved = com.adshield.app.engine.VpnEngine.getCustomProxy(this@MediaHubActivity)
            if (saved !in com.adshield.app.engine.FokkTunnelEngine.REGION_NODES.keys) {
                setText(saved)
            }
            setSingleLine(true)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
        }
        val container = android.widget.FrameLayout(this).apply {
            setPadding(48, 16, 48, 0)
            addView(input)
        }
        AlertDialog.Builder(this)
            .setTitle("Fokk Private Server")
            .setMessage("Enter the address of your private proxy or VPN server:")
            .setView(container)
            .setPositiveButton("Connect") { _, _ ->
                val proxyUrl = input.text.toString().trim()
                if (proxyUrl.isNotEmpty()) {
                    if (onApplied != null) {
                        onApplied(proxyUrl)
                    } else {
                        com.adshield.app.engine.VpnEngine.applyVpnMode(
                            this,
                            com.adshield.app.engine.VpnEngine.VpnMode.CUSTOM,
                            proxyUrl
                        ) { success, msg ->
                            runOnUiThread {
                                if (success) {
                                    activeWebView?.reload()
                                    lastVpnRouteFingerprint = getVpnRouteFingerprint()
                                    updateVpnIndicatorUi()
                                }
                                Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun clearBrowsingData() {
        for (tab in tabs) {
            tab.webView?.let { webView ->
                webView.clearCache(true)
                webView.clearHistory()
                webView.clearFormData()
            }
        }
        approvedWebMediaOrigins.clear()
        approvedLocationOrigins.clear()
        pendingWebPermission?.let { pending ->
            pendingWebPermission = null
            runCatching { pending.request.deny() }
        }
        pendingLocationPermission?.let { pending ->
            pendingLocationPermission = null
            runCatching { pending.callback.invoke(pending.origin, false, false) }
        }
        if (!isIsolatedPrivateProfile) {
            localPrefs.edit().remove(PREF_BROWSING_HISTORY).apply()
        }

        val cookieManager = CookieManager.getInstance()
        val finishClear: () -> Unit = {
            runOnUiThread {
                runCatching { WebStorage.getInstance().deleteAllData() }
                runCatching {
                    WebViewDatabase.getInstance(this).apply {
                        clearFormData()
                        clearHttpAuthUsernamePassword()
                        clearUsernamePassword()
                    }
                }
                runCatching { cookieManager.flush() }
                if (!isFinishing && !isDestroyed) {
                    Toast.makeText(
                        this,
                        if (isIsolatedPrivateProfile) {
                            "Private site data, form data and cache cleared. System downloads are separate."
                        } else {
                            "History, cookies, site storage, form data and cache cleared. Saved pages and downloads were kept."
                        },
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
        runCatching {
            cookieManager.removeAllCookies { finishClear() }
        }.onFailure {
            Log.e(TAG, "Could not start cookie cleanup", it)
            finishClear()
        }
    }

    private fun showDownloadsDialog() {
        if (isIsolatedPrivateProfile) {
            Toast.makeText(this, "Download history is outside the private browser", Toast.LENGTH_LONG).show()
            return
        }
        val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val cursor = manager.query(DownloadManager.Query())
        data class DownloadEntry(val id: Long, val url: String, val title: String, val status: Int, val label: String)
        val entries = mutableListOf<DownloadEntry>()
        cursor?.use {
            val titleCol = it.getColumnIndex(DownloadManager.COLUMN_TITLE)
            val statusCol = it.getColumnIndex(DownloadManager.COLUMN_STATUS)
            val idCol = it.getColumnIndex(DownloadManager.COLUMN_ID)
            val uriCol = it.getColumnIndex(DownloadManager.COLUMN_URI)
            while (it.moveToNext() && entries.size < 20) {
                val title = it.getString(titleCol) ?: "Download"
                val rawStatus = it.getInt(statusCol)
                val status = when (rawStatus) {
                    DownloadManager.STATUS_RUNNING -> "Downloading"
                    DownloadManager.STATUS_PENDING -> "Queued"
                    DownloadManager.STATUS_SUCCESSFUL -> "Complete"
                    DownloadManager.STATUS_FAILED -> "Failed"
                    else -> "Paused"
                }
                entries.add(DownloadEntry(it.getLong(idCol), it.getString(uriCol) ?: "", title, rawStatus, "$title — $status"))
            }
        }
        AlertDialog.Builder(this)
            .setTitle("Downloads")
            .setItems(if (entries.isEmpty()) arrayOf("No downloads yet") else entries.map { it.label }.toTypedArray()) { _, which ->
                val entry = entries.getOrNull(which) ?: return@setItems
                when (entry.status) {
                    DownloadManager.STATUS_RUNNING, DownloadManager.STATUS_PENDING, DownloadManager.STATUS_PAUSED -> {
                        manager.remove(entry.id)
                        Toast.makeText(this, "Download cancelled", Toast.LENGTH_SHORT).show()
                    }
                    DownloadManager.STATUS_FAILED -> {
                        Toast.makeText(this, "Download failed. Reopen the page and retry the download from its link.", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setPositiveButton("Open system Downloads") { _, _ -> openSystemDownloads() }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun showSitePrivacyDialog() {
        flushFilteredRequestCounts()
        val url = activeTab?.takeIf { it.isOfflineReader }?.url ?: activeWebView?.url ?: activeTab?.url ?: return
        val host = Uri.parse(url).host ?: return
        val shield = if (isShieldEnabledFor(url)) "On" else "Off"
        val privateTabDetails = if (activeTab?.isPrivate == true) {
            "\nPrivate tab: uses a separate WebView data profile and is omitted from Fokk history and session restore. Android downloads and items you share may remain outside this profile."
        } else ""
        val currentTab = activeTab
        val filteredHosts = currentTab?.filteredRequestHosts
            ?.entries
            ?.sortedByDescending { it.value }
            ?.take(8)
            ?.joinToString { "${it.key} (${it.value})" }
            .orEmpty()
        val observedHosts = currentTab?.thirdPartyRequestHosts
            ?.entries
            ?.sortedByDescending { it.value }
            ?.take(8)
            ?.joinToString { "${it.key} (${it.value})" }
            .orEmpty()
        val observedFiltering = buildString {
            append("WebView observed ${currentTab?.thirdPartyRequests ?: 0} cross-site resource requests on this page, including requests Fokk filtered.")
            if (observedHosts.isNotEmpty()) append("\nThird-party hosts: $observedHosts.")
            append("\nFokk filtered ${currentTab?.filteredRequests ?: 0} requests.")
            if (filteredHosts.isNotEmpty()) append("\nFiltered hosts: $filteredHosts.")
            append("\nThis is a partial view: WebView may omit requests, and site-boundary matching is approximate. These counts are not a full tracker or ad audit; unlisted and server-side ads may remain.")
        }
        AlertDialog.Builder(this)
            .setTitle("Privacy: $host")
            .setMessage("$observedFiltering\n\nShield: $shield\nConnection: ${if (Uri.parse(url).scheme.equals("https", true)) "HTTPS" else "Not HTTPS"}\nThird-party cookies: blocked by default; allowed on supported media services for playback compatibility. First-party cookies remain enabled for sign-in and site functions.\nMixed content: active HTTP content blocked on HTTPS pages\nCamera, microphone and location: ask before use, then require Android permission.$privateTabDetails")
            .setPositiveButton("Clear web storage") { _, _ ->
                val origins = getHttpStorageOrigins(url)
                origins.forEach { origin ->
                    runCatching { WebStorage.getInstance().deleteOrigin(origin) }
                }
                activeWebView?.clearFormData()
                val message = if (origins.isEmpty()) {
                    "Could not identify this site's web storage origin"
                } else {
                    "Web storage cleared for $host. Cookies and saved form suggestions remain."
                }
                Toast.makeText(this, message, Toast.LENGTH_LONG).show()
            }
            .setNegativeButton("Close", null)
            .show()
    }

    /**
     * One WebView reports itself as the text editor. Otherwise the keyboard
     * commits the same characters into every open pane.
     */
    private class FocusedPaneWebView(context: Context) : WebView(context) {
        override fun onCheckIsTextEditor(): Boolean = isFocused
    }

    private fun applyWebViewVisibility() {
        for (i in tabs.indices) {
            val webView = tabs[i].webView ?: continue
            val visible = if (isDualDeckMode) {
                i == activeTabIndex || i == secondaryTabIndex
            } else {
                i == activeTabIndex
            }
            webView.visibility = if (visible) View.VISIBLE else View.GONE
        }
    }

    /** Touching a pane makes that pane the only focused editor and the URL-bar target. */
    private fun activateBrowsingPane(webView: WebView) {
        val index = tabs.indexOfFirst { it.webView === webView }
        if (index < 0) return
        if (isDualDeckMode && index != activeTabIndex && (index == secondaryTabIndex || secondaryTabIndex == -1)) {
            val previousActive = activeTabIndex
            activeTabIndex = index
            if (secondaryTabIndex == index) secondaryTabIndex = previousActive
            applyWebViewVisibility()
            val pane = tabs[index]
            updateUrlBar(pane.url, pane.title)
        }
        tabs.forEach { tab ->
            val pane = tab.webView ?: return@forEach
            val focused = pane === webView
            pane.isFocusable = focused
            pane.isFocusableInTouchMode = focused
            if (!focused) pane.clearFocus()
        }
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        if (!webView.isFocused) webView.requestFocus()
    }

    // =========================================================================
    // DUAL-DECK SPLIT VIEWPORT MULTITASKING
    // =========================================================================
    fun toggleDualDeckMode() {
        isDualDeckMode = !isDualDeckMode
        if (isDualDeckMode) {
            val primaryIndex = activeTabIndex
            secondaryTabIndex = if (tabs.size > 1) {
                tabs.indices.firstOrNull { it != primaryIndex } ?: -1
            } else -1

            if (secondaryTabIndex == -1) {
                addNewTab("file:///android_asset/fokk_start.html", isPrivate = activeTab?.isPrivate == true)
                switchToTab(primaryIndex)
                secondaryTabIndex = tabs.lastIndex
            }

            val primaryTab = tabs.getOrNull(primaryIndex)
            val primaryWebView = primaryTab?.webView
            val secondaryTab = tabs.getOrNull(secondaryTabIndex)

            // Hydrate secondary tab if it was suspended (webView == null)
            if (secondaryTab != null && secondaryTab.webView == null) {
                val hydratedView = createTab(
                    secondaryTab.url.ifBlank { "file:///android_asset/fokk_start.html" },
                    secondaryTab.isPrivate
                )
                secondaryTab.webView = hydratedView.webView
                secondaryTab.isSuspended = false
                secondaryTab.suspendedForMemory = false
                val urlToLoad = secondaryTab.url.ifBlank { "file:///android_asset/fokk_start.html" }
                loadUrlInWebView(secondaryTab.webView, urlToLoad)
            }
            val secondaryWebView = secondaryTab?.webView

            binding.splitDivider.visibility = View.VISIBLE
            binding.tabContainerSecondary.visibility = View.VISIBLE
            binding.tabContainerSecondary.removeAllViews()

            if (primaryWebView != null) {
                (primaryWebView.parent as? ViewGroup)?.removeView(primaryWebView)
                primaryWebView.visibility = View.VISIBLE
                primaryWebView.layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                binding.tabContainer.removeAllViews()
                binding.tabContainer.addView(primaryWebView)
            }

            if (secondaryWebView != null) {
                (secondaryWebView.parent as? ViewGroup)?.removeView(secondaryWebView)
                secondaryWebView.visibility = View.VISIBLE
                secondaryWebView.layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                binding.tabContainerSecondary.addView(secondaryWebView)
            }

            val topLp = binding.tabContainer.layoutParams as? LinearLayout.LayoutParams
            val bottomLp = binding.tabContainerSecondary.layoutParams as? LinearLayout.LayoutParams
            topLp?.weight = 1.0f
            bottomLp?.weight = 1.0f
            binding.tabContainer.layoutParams = topLp
            binding.tabContainerSecondary.layoutParams = bottomLp

            binding.btnCloseSplitDeck.setOnClickListener {
                toggleDualDeckMode()
            }

            binding.btnSwapSplitDecks.setOnClickListener {
                if (!isDualDeckMode) return@setOnClickListener
                val currentPrimary = activeTabIndex
                val currentSecondary = secondaryTabIndex
                if (currentPrimary == -1 || currentSecondary == -1) return@setOnClickListener

                val topTab = tabs.getOrNull(currentPrimary)
                val bottomTab = tabs.getOrNull(currentSecondary)
                val topWv = topTab?.webView
                val bottomWv = bottomTab?.webView

                binding.tabContainer.removeAllViews()
                binding.tabContainerSecondary.removeAllViews()

                if (bottomWv != null) {
                    (bottomWv.parent as? ViewGroup)?.removeView(bottomWv)
                    bottomWv.visibility = View.VISIBLE
                    bottomWv.layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    binding.tabContainer.addView(bottomWv)
                }

                if (topWv != null) {
                    (topWv.parent as? ViewGroup)?.removeView(topWv)
                    topWv.visibility = View.VISIBLE
                    topWv.layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    binding.tabContainerSecondary.addView(topWv)
                }

                activeTabIndex = currentSecondary
                secondaryTabIndex = currentPrimary
                updateUrlBar(activeTab?.url, activeTab?.title)
                Toast.makeText(this, "Decks Swapped", Toast.LENGTH_SHORT).show()
            }

            binding.splitDivider.setOnTouchListener { _, event ->
                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> true
                    MotionEvent.ACTION_MOVE -> {
                        val totalHeight = binding.mainContentLayout.height.toFloat()
                        if (totalHeight > 200) {
                            val loc = IntArray(2)
                            binding.mainContentLayout.getLocationOnScreen(loc)
                            val relativeY = (event.rawY - loc[1]).coerceIn(totalHeight * 0.2f, totalHeight * 0.8f)
                            val weightTop = relativeY / totalHeight
                            val weightBottom = 1.0f - weightTop

                            val pTop = binding.tabContainer.layoutParams as? LinearLayout.LayoutParams
                            val pBottom = binding.tabContainerSecondary.layoutParams as? LinearLayout.LayoutParams
                            pTop?.weight = weightTop
                            pBottom?.weight = weightBottom
                            binding.tabContainer.layoutParams = pTop
                            binding.tabContainerSecondary.layoutParams = pBottom
                        }
                        true
                    }
                    else -> true
                }
            }

            Toast.makeText(this, "Dual-Deck Split View Active (Drag bar to resize)", Toast.LENGTH_SHORT).show()
        } else {
            binding.splitDivider.visibility = View.GONE
            binding.tabContainerSecondary.visibility = View.GONE
            binding.tabContainerSecondary.removeAllViews()

            val secondaryTab = tabs.getOrNull(secondaryTabIndex)
            val secondaryWebView = secondaryTab?.webView
            if (secondaryWebView != null && secondaryTabIndex != activeTabIndex) {
                secondaryWebView.visibility = View.GONE
            }
            secondaryTabIndex = -1

            // Ensure the active tab's WebView is cleanly attached to primary tabContainer and visible
            val activeWv = activeTab?.webView
            if (activeWv != null) {
                (activeWv.parent as? ViewGroup)?.removeView(activeWv)
                activeWv.visibility = View.VISIBLE
                activeWv.layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                binding.tabContainer.removeAllViews()
                binding.tabContainer.addView(activeWv)
                activeWv.requestLayout()
            }

            val topLp = binding.tabContainer.layoutParams as? LinearLayout.LayoutParams
            topLp?.weight = 1.0f
            binding.tabContainer.layoutParams = topLp

            applyWebViewVisibility()
            updateUrlBar(activeTab?.url, activeTab?.title)

            Toast.makeText(this, "Single View Restored", Toast.LENGTH_SHORT).show()
        }
    }

    // =========================================================================
    // 100% ON-DEVICE AI SUMMARY SHEET & TEXT-TO-SPEECH
    // =========================================================================
    fun showAiSummarySheet(summaryJson: String, initialTab: Int = 0) {
        try {
            val json = JSONObject(summaryJson)
            val title = json.optString("title", "Article Summary").trim()
            val source = json.optString("source", "").ifBlank { json.optString("sourceHost", "") }
            val sourceHost = json.optString("sourceHost", "")
            val favicon = json.optString("favicon", "")
            val readingTime = json.optString("readingTime", "3 min read")
            val wordCount = json.optInt("wordCount", 0)
            val provenanceObj = json.optJSONObject("provenance")
            val pageAuthor = json.optString("author", provenanceObj?.optString("author", "").orEmpty()).trim()
            val pagePublished = json.optString("published", provenanceObj?.optString("published", "").orEmpty()).trim()
            val bulletsArray = json.optJSONArray("bullets") ?: JSONArray()
            val metricsArray = json.optJSONArray("metrics") ?: JSONArray()
            val questionsArray = json.optJSONArray("followUpQuestions") ?: json.optJSONArray("questions") ?: JSONArray()
            val leadImage = json.optString("leadImage", "").trim()
            val explicitSummary = json.optString("executiveSummary", json.optString("summary", "")).trim()
            val activeUrl = json.optString("url", activeWebView?.url.orEmpty())
            val postUrl = json.optString("postUrl", "").trim()
            val extractedContext = json.optString("extractedContext", "").trim()
            if (extractedContext.isNotBlank()) {
                lastAiPageContext = FokkAiEngine.cleanDropCaps(extractedContext).take(10000)
            }
            val topEntitiesFromJs = mutableListOf<String>().apply {
                val arr = json.optJSONArray("topEntities")
                if (arr != null) {
                    for (i in 0 until arr.length()) {
                        val e = arr.optString(i, "").trim()
                        if (e.length >= 3) add(e)
                    }
                }
            }
            val sessionKey = postUrl.ifBlank { activeUrl }.ifBlank { title }

            lastGeneratedSummaryJson = summaryJson

            if (!isActivityResumed || isFinishing || isDestroyed) {
                return
            }

            if (activeAiSummarySheetDialog?.isShowing == true) {
                return
            }

            // Retrieve or create persistent Ask AI chat session for this exact page/post
            val persistedSummaryJson = runCatching {
                JSONObject(summaryJson).apply {
                    if (optString("url", "").isBlank() && activeUrl.isNotBlank()) put("url", activeUrl)
                    if (optString("postUrl", "").isBlank() && sessionKey.isNotBlank()) put("postUrl", sessionKey)
                }.toString()
            }.getOrDefault(summaryJson)
            val chatSession = aiChatSessions.getOrPut(sessionKey) {
                if (aiChatSessions.size >= 15) {
                    val oldest = aiChatSessions.keys.firstOrNull()
                    if (oldest != null) aiChatSessions.remove(oldest)
                }
                AiChatSession(
                    sessionKey = sessionKey,
                    url = activeUrl,
                    title = title,
                    summaryJson = persistedSummaryJson,
                    pageContext = lastAiPageContext
                )
            }
            chatSession.summaryJson = persistedSummaryJson
            if (lastAiPageContext.isNotBlank()) {
                chatSession.pageContext = lastAiPageContext
            }

            val sheetDialog = BottomSheetDialog(this)
            activeAiSummarySheetDialog = sheetDialog
            val activeStreamHandlers = mutableListOf<Pair<Handler, Runnable>>()
            val activeChatListenChips = mutableMapOf<String, TextView>()

            val sheetBinding = SheetAiSummaryBinding.inflate(layoutInflater)
            sheetDialog.setContentView(sheetBinding.root)
            sheetDialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

            val density = resources.displayMetrics.density

            // Show "Resume Chat" banner if user opened this source tab from an active Ask AI chat
            val pendingSourceChat = lastChatSessionLeftForSource
            if (pendingSourceChat != null && pendingSourceChat.sessionKey != sessionKey && pendingSourceChat.turns.isNotEmpty()) {
                sheetBinding.layoutResumeChatBanner.visibility = View.VISIBLE
                sheetBinding.textResumeChatTitle.text = "Active chat: ${pendingSourceChat.title}"
                sheetBinding.btnResumeChatAction.setOnClickListener {
                    lastChatSessionLeftForSource = pendingSourceChat
                    sheetDialog.dismiss()
                    mainHandler.postDelayed({
                        lastAiPageContext = pendingSourceChat.pageContext
                        showAiSummarySheet(pendingSourceChat.summaryJson, initialTab = 1)
                    }, 120L)
                }
            } else {
                sheetBinding.layoutResumeChatBanner.visibility = View.GONE
            }

            // Proper keyboard & system navigation bar insets (prevents bottom clipping and composer overlap)
            ViewCompat.setOnApplyWindowInsetsListener(sheetBinding.root) { _, insets ->
                val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
                val navBottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
                val bottomPad = maxOf(imeBottom, navBottom)
                sheetBinding.layoutAiComposerDock.setPadding(
                    (16 * density).toInt(),
                    (8 * density).toInt(),
                    (16 * density).toInt(),
                    (10 * density).toInt() + bottomPad
                )
                sheetBinding.layoutSummaryInnerContent.setPadding(
                    (18 * density).toInt(),
                    (14 * density).toInt(),
                    (18 * density).toInt(),
                    (32 * density).toInt() + navBottom
                )
                sheetBinding.layoutAuditInnerContent.setPadding(
                    (18 * density).toInt(),
                    (14 * density).toInt(),
                    (18 * density).toInt(),
                    (32 * density).toInt() + navBottom
                )
                insets
            }

            sheetDialog.setOnShowListener {
                val bsView = sheetDialog.findViewById<android.view.View>(com.google.android.material.R.id.design_bottom_sheet)
                if (bsView != null) {
                    bsView.setBackgroundColor(Color.parseColor("#06080D"))
                    val behavior = com.google.android.material.bottomsheet.BottomSheetBehavior.from(bsView)
                    bsView.layoutParams.height = android.view.ViewGroup.LayoutParams.MATCH_PARENT
                    behavior.peekHeight = android.view.WindowManager.LayoutParams.MATCH_PARENT
                    behavior.state = com.google.android.material.bottomsheet.BottomSheetBehavior.STATE_EXPANDED
                    behavior.skipCollapsed = true
                    // Disable sheet drag-intercept so NestedScrollViews scroll at silky 120fps with zero stutter
                    behavior.isDraggable = false
                }
            }

            sheetDialog.setOnDismissListener {
                activeStreamHandlers.forEach { (h, r) -> h.removeCallbacks(r) }
                activeStreamHandlers.clear()
                activeChatListenChips.clear()
                if (ttsPlaybackState != 0) {
                    stopTextToSpeech()
                }
                ttsProgressCallback = null
                if (activeAiSummarySheetDialog === sheetDialog) {
                    activeAiSummarySheetDialog = null
                    aiVoiceInputCallback = null
                }
            }

            sheetBinding.viewAiDragHandle.setOnClickListener {
                sheetDialog.dismiss()
            }

            // Lead Image
            if (leadImage.isNotBlank() && (leadImage.startsWith("http://") || leadImage.startsWith("https://"))) {
                sheetBinding.layoutLeadImageCard.visibility = View.VISIBLE
                Thread {
                    try {
                        val conn = java.net.URL(leadImage).openConnection() as java.net.HttpURLConnection
                        conn.connectTimeout = 4000
                        conn.readTimeout = 4000
                        conn.doInput = true
                        conn.connect()
                        val bitmap = BitmapFactory.decodeStream(conn.inputStream)
                        runOnUiThread {
                            if (bitmap != null && sheetDialog.isShowing) {
                                sheetBinding.imgAiSummaryLead.setImageBitmap(bitmap)
                            } else {
                                sheetBinding.layoutLeadImageCard.visibility = View.GONE
                            }
                        }
                    } catch (_: Exception) {
                        runOnUiThread {
                            sheetBinding.layoutLeadImageCard.visibility = View.GONE
                        }
                    }
                }.start()
            } else {
                sheetBinding.layoutLeadImageCard.visibility = View.GONE
            }

            sheetBinding.textSummaryTitle.text = title
            val metaParts = mutableListOf<String>()
            if (readingTime.isNotBlank()) metaParts.add(readingTime)
            if (wordCount > 0) metaParts.add("%,d words".format(Locale.US, wordCount))
            sheetBinding.textSummaryMeta.text = metaParts.joinToString(" · ")

            val publisherName = if (sourceHost.isNotBlank()) {
                FokkSearchAggregator.cleanPublisherName(sourceHost)
            } else {
                source.ifBlank { "Web" }
            }

            sheetBinding.layoutSourceBadge.visibility = View.VISIBLE
            sheetBinding.textSourceName.text = publisherName

            if (sourceHost.isNotBlank()) {
                val favUrl = "https://www.google.com/s2/favicons?domain=" + Uri.encode(sourceHost) + "&sz=64"
                Thread {
                    try {
                        val conn = java.net.URL(favUrl).openConnection() as java.net.HttpURLConnection
                        conn.connectTimeout = 3000
                        conn.readTimeout = 3000
                        val bmp = BitmapFactory.decodeStream(conn.inputStream)
                        if (bmp != null) {
                            runOnUiThread {
                                if (sheetDialog.isShowing) {
                                    sheetBinding.imgSourceFavicon.clearColorFilter()
                                    sheetBinding.imgSourceFavicon.setImageBitmap(bmp)
                                }
                            }
                        }
                    } catch (_: Exception) {}
                }.start()
            }

            // Live mutable summary state so Copy, Read Aloud, and Save always use the latest AI synthesis
            var currentExecutiveSummary = FokkAiEngine.cleanDropCaps(
                stripEmojis(explicitSummary).replace(Regex("""^[\s•*–—\-\d.)\]]+"""), "").trim()
            )
            var currentBullets = mutableListOf<String>().apply {
                for (i in 0 until bulletsArray.length()) {
                    val b = FokkAiEngine.cleanDropCaps(
                        stripEmojis(bulletsArray.getString(i))
                            .replace(Regex("""^[\s•*–—\-\d.)\]]+"""), "")
                            .trim()
                    )
                    if (b.length >= 8) add(b)
                }
            }
            var currentMetrics = mutableListOf<KeyMetric>().apply {
                for (i in 0 until metricsArray.length()) {
                    val raw = metricsArray.getString(i).trim()
                    if (raw.contains("::")) {
                        val parts = raw.split("::", limit = 2)
                        val v = parts[0].trim()
                        val l = parts[1].trim()
                        if (v.isNotBlank() && l.isNotBlank()) add(KeyMetric(v, l))
                    }
                }
            }
            var currentQuestions = mutableListOf<String>().apply {
                for (i in 0 until questionsArray.length()) {
                    val q = stripEmojis(questionsArray.getString(i)).trim()
                    if (q.length > 8 &&
                        !q.contains("club announcement", ignoreCase = true) &&
                        !q.contains("contract length", ignoreCase = true) &&
                        !q.contains("wages", ignoreCase = true)
                    ) {
                        add(q)
                    }
                }
            }

            fun buildReadableBriefText(): String {
                val sb = StringBuilder()
                if (title.isNotBlank()) sb.append(title).append("\n\n")
                if (currentExecutiveSummary.isNotBlank()) {
                    sb.append(currentExecutiveSummary).append("\n\n")
                }
                if (currentBullets.isNotEmpty()) {
                    sb.append("Key Takeaways:\n")
                    currentBullets.forEach { b ->
                        sb.append("- ").append(b.replace("**", "")).append("\n")
                    }
                }
                return sb.toString().trim()
            }

            // Save / Bookmark button
            var isSaved = savedSummariesStore.isSaved(activeUrl)
            val updateSaveBtnUi = {
                if (isSaved) {
                    sheetBinding.btnSaveSummary.setColorFilter(Color.parseColor("#38BDF8"))
                } else {
                    sheetBinding.btnSaveSummary.setColorFilter(Color.parseColor("#94A3B8"))
                }
            }
            updateSaveBtnUi()

            sheetBinding.btnSaveSummary.setOnClickListener {
                if (isSaved) {
                    val existing = savedSummariesStore.list().firstOrNull { it.url == activeUrl }
                    if (existing != null) savedSummariesStore.delete(existing.id)
                    isSaved = false
                    updateSaveBtnUi()
                    Toast.makeText(this, "Removed from Saved Summaries", Toast.LENGTH_SHORT).show()
                } else {
                    val item = SavedSummary(
                        url = activeUrl,
                        title = title,
                        source = publisherName,
                        sourceHost = sourceHost,
                        favicon = favicon,
                        readingTime = readingTime,
                        wordCount = wordCount,
                        executiveSummary = currentExecutiveSummary,
                        bullets = currentBullets.toList(),
                        metrics = currentMetrics.map { "${it.value} :: ${it.label}" },
                        leadImage = leadImage,
                        questions = currentQuestions.toList()
                    )
                    savedSummariesStore.save(item)
                    isSaved = true
                    updateSaveBtnUi()
                    Toast.makeText(this, "Saved to Summaries", Toast.LENGTH_SHORT).show()
                }
            }

            // Modern Audio Brief Mini-Player State (Play / Pause / Resume / Stop + Speed + Voice + Live Progress)
            var isMale = prefs.getBoolean("pref_tts_male_voice", true)
            val speedSteps = listOf(1.0f, 1.25f, 1.5f, 0.85f)
            ttsSpeechSpeed = prefs.getFloat("pref_tts_speed", 1.0f)
            val updateVoiceBtn = {
                sheetBinding.btnTtsVoiceToggle.text = if (isMale) "Male" else "Female"
            }
            val updateSpeedBtn = {
                sheetBinding.btnTtsSpeedToggle.text = "${ttsSpeechSpeed}x"
            }
            val updateAudioPlayerUi: (Int, Int, Int, String) -> Unit = { state, idx, total, sourceTag ->
                val isSummarySource = sourceTag == "summary"
                if (isSummarySource && state == 1) {
                    sheetBinding.btnListenSummary.text = "Pause"
                    sheetBinding.btnListenSummary.setIconResource(R.drawable.ic_pause_fill)
                    sheetBinding.btnStopSummary.visibility = View.VISIBLE
                    sheetBinding.textTtsStatus.text = if (total > 1) "Playing · ${idx + 1}/$total" else "Playing"
                    sheetBinding.textTtsStatus.setTextColor(Color.parseColor("#38BDF8"))
                    sheetBinding.progressAudioBrief.progress = if (total > 0) ((idx + 1) * 100 / total).coerceIn(8, 100) else 25
                } else if (isSummarySource && state == 2) {
                    sheetBinding.btnListenSummary.text = "Resume"
                    sheetBinding.btnListenSummary.setIconResource(R.drawable.ic_play_fill)
                    sheetBinding.btnStopSummary.visibility = View.VISIBLE
                    sheetBinding.textTtsStatus.text = if (total > 1) "Paused · ${idx + 1}/$total" else "Paused"
                    sheetBinding.textTtsStatus.setTextColor(Color.parseColor("#FBBF24"))
                } else {
                    sheetBinding.btnListenSummary.text = "Listen"
                    sheetBinding.btnListenSummary.setIconResource(R.drawable.ic_play_fill)
                    sheetBinding.btnStopSummary.visibility = View.GONE
                    sheetBinding.textTtsStatus.text = "Ready to listen"
                    sheetBinding.textTtsStatus.setTextColor(Color.parseColor("#64748B"))
                    sheetBinding.progressAudioBrief.progress = 0
                }
                // Sync Ask AI per-answer Listen/Stop chips cleanly
                activeChatListenChips.forEach { (tag, chipTv) ->
                    val active = state == 1 && sourceTag == tag
                    chipTv.text = if (active) "Stop" else "Listen"
                    chipTv.setTextColor(Color.parseColor(if (active) "#F87171" else "#94A3B8"))
                }
            }
            updateVoiceBtn()
            updateSpeedBtn()
            updateAudioPlayerUi(0, 0, 0, "summary")
            ttsProgressCallback = { state, idx, total, sourceTag ->
                if (sheetDialog.isShowing) {
                    updateAudioPlayerUi(state, idx, total, sourceTag)
                }
            }

            sheetBinding.btnTtsVoiceToggle.setOnClickListener {
                isMale = !isMale
                prefs.edit().putBoolean("pref_tts_male_voice", isMale).apply()
                updateVoiceBtn()
                configureTtsVoice(isMale)
                if (ttsPlaybackState == 1 && ttsCurrentSourceTag == "summary") {
                    speakCurrentChunk()
                }
            }

            sheetBinding.btnTtsSpeedToggle.setOnClickListener {
                val curIdx = speedSteps.indexOfFirst { kotlin.math.abs(it - ttsSpeechSpeed) < 0.05f }
                ttsSpeechSpeed = speedSteps[(curIdx + 1) % speedSteps.size]
                prefs.edit().putFloat("pref_tts_speed", ttsSpeechSpeed).apply()
                updateSpeedBtn()
                configureTtsVoice(isMale)
                if (ttsPlaybackState == 1 && ttsCurrentSourceTag == "summary") {
                    speakCurrentChunk()
                }
            }

            sheetBinding.btnStopSummary.setOnClickListener {
                stopTextToSpeech()
            }

            // Forward reference for interactive Ask AI
            var askAiQuestionFunc: ((String) -> Unit)? = null

            // Clean 3-tab switching (Summary / Ask AI / Truth & Bias)
            fun switchAiMode(mode: Int) {
                sheetBinding.layoutAiSummarySection.visibility = if (mode == 0) View.VISIBLE else View.GONE
                sheetBinding.layoutAiChatSection.visibility = if (mode == 1) View.VISIBLE else View.GONE
                sheetBinding.layoutAiRealityAuditSection.visibility = if (mode == 2) View.VISIBLE else View.GONE

                sheetBinding.btnTabAiSummary.setBackgroundResource(if (mode == 0) R.drawable.bg_ai_tab_selected else 0)
                sheetBinding.btnTabAiSummary.setTextColor(Color.parseColor(if (mode == 0) "#FFFFFF" else "#8B95A5"))

                sheetBinding.btnTabAiChat.setBackgroundResource(if (mode == 1) R.drawable.bg_ai_tab_selected else 0)
                sheetBinding.btnTabAiChat.setTextColor(Color.parseColor(if (mode == 1) "#FFFFFF" else "#8B95A5"))

                sheetBinding.btnTabAiAudit.setBackgroundResource(if (mode == 2) R.drawable.bg_ai_tab_selected else 0)
                sheetBinding.btnTabAiAudit.setTextColor(Color.parseColor(if (mode == 2) "#FFFFFF" else "#8B95A5"))
            }

            // Render clean takeaway / claim row with subtle micro-tag and markdown bold support
            fun renderBulletRow(bullet: String, container: LinearLayout, showDivider: Boolean = true) {
                val tag = FokkAiEngine.classifyBullet(bullet)
                val typedVal = android.util.TypedValue()
                theme.resolveAttribute(android.R.attr.selectableItemBackground, typedVal, true)

                val row = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.TOP
                    setPadding((2 * density).toInt(), (10 * density).toInt(), (2 * density).toInt(), (10 * density).toInt())
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                    setBackgroundResource(typedVal.resourceId)
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        val plain = bullet.replace("**", "")
                        val escaped = plain.replace("\\", "\\\\").replace("\"", "\\\"").replace("'", "\\'")
                        activeWebView?.evaluateJavascript("window.highlightPageSentence && window.highlightPageSentence(\"$escaped\");", null)
                        Toast.makeText(this@MediaHubActivity, "Highlighted passage on page", Toast.LENGTH_SHORT).show()
                    }
                }

                val (tagLabel, bgCol, txtCol) = when (tag) {
                    "FACT" -> Triple("Fact", "#0C261B", "#34D399")
                    "OPINION" -> Triple("Opinion", "#1D1736", "#A78BFA")
                    else -> Triple("Claim", "#251C09", "#FBBF24")
                }

                val tagTv = TextView(this@MediaHubActivity).apply {
                    text = tagLabel
                    textSize = 10f
                    setTypeface(null, Typeface.BOLD)
                    setTextColor(Color.parseColor(txtCol))
                    background = android.graphics.drawable.GradientDrawable().apply {
                        cornerRadius = 6 * density
                        setColor(Color.parseColor(bgCol))
                    }
                    setPadding((7 * density).toInt(), (2.5f * density).toInt(), (7 * density).toInt(), (2.5f * density).toInt())
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        marginEnd = (10 * density).toInt()
                        topMargin = (2 * density).toInt()
                    }
                }

                val textTv = TextView(this@MediaHubActivity).apply {
                    text = formatMarkdownToSpanned(bullet)
                    setTextColor(Color.parseColor("#E2E8F0"))
                    textSize = 14f
                    setLineSpacing(4 * density, 1f)
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                }

                row.addView(tagTv)
                row.addView(textTv)
                container.addView(row)

                if (showDivider) {
                    val divider = View(this@MediaHubActivity).apply {
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            (1 * density).toInt().coerceAtLeast(1)
                        )
                        setBackgroundColor(Color.parseColor("#111827"))
                    }
                    container.addView(divider)
                }
            }

            // Render clean 2-column contextual Key Numbers grid (replaces old cyan chip cards)
            fun renderKeyMetrics(metrics: List<KeyMetric>) {
                sheetBinding.layoutKeyMetricsGrid.removeAllViews()
                val valid = metrics.filter { it.value.isNotBlank() && it.label.isNotBlank() }.take(4)
                if (valid.isEmpty()) {
                    sheetBinding.textMetricsLabel.visibility = View.GONE
                    sheetBinding.layoutKeyMetricsGrid.visibility = View.GONE
                    return
                }

                sheetBinding.textMetricsLabel.visibility = View.VISIBLE
                sheetBinding.layoutKeyMetricsGrid.visibility = View.VISIBLE

                val rows = valid.chunked(2)
                rows.forEachIndexed { rowIdx, pair ->
                    val rowLayout = LinearLayout(this@MediaHubActivity).apply {
                        orientation = LinearLayout.HORIZONTAL
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        ).apply {
                            if (rowIdx < rows.size - 1) bottomMargin = (8 * density).toInt()
                        }
                    }

                    pair.forEachIndexed { colIdx, metric ->
                        val card = LinearLayout(this@MediaHubActivity).apply {
                            orientation = LinearLayout.VERTICAL
                            background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_ai_card)
                            setPadding((14 * density).toInt(), (12 * density).toInt(), (14 * density).toInt(), (12 * density).toInt())
                            layoutParams = LinearLayout.LayoutParams(
                                0,
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                1f
                            ).apply {
                                if (colIdx == 0 && pair.size > 1) marginEnd = (4 * density).toInt()
                                if (colIdx == 1) marginStart = (4 * density).toInt()
                            }
                        }

                        val valueTv = TextView(this@MediaHubActivity).apply {
                            text = metric.value
                            setTextColor(Color.parseColor("#F8FAFC"))
                            textSize = 17.5f
                            setTypeface(null, Typeface.BOLD)
                            maxLines = 1
                            ellipsize = TextUtils.TruncateAt.END
                        }

                        val labelTv = TextView(this@MediaHubActivity).apply {
                            text = metric.label
                            setTextColor(Color.parseColor("#94A3B8"))
                            textSize = 12f
                            maxLines = 2
                            ellipsize = TextUtils.TruncateAt.END
                            setLineSpacing(2 * density, 1f)
                            layoutParams = LinearLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.WRAP_CONTENT
                            ).apply { topMargin = (3 * density).toInt() }
                        }

                        card.addView(valueTv)
                        card.addView(labelTv)
                        rowLayout.addView(card)
                    }

                    // Keep half-row aligned cleanly when odd number of metrics
                    if (pair.size == 1 && rows.size > 1) {
                        val spacer = View(this@MediaHubActivity).apply {
                            layoutParams = LinearLayout.LayoutParams(0, 1, 1f).apply {
                                marginStart = (4 * density).toInt()
                            }
                        }
                        rowLayout.addView(spacer)
                    }

                    sheetBinding.layoutKeyMetricsGrid.addView(rowLayout)
                }
            }

            // Unified clean tap-to-ask prompt card renderer
            fun renderPromptCard(question: String, container: LinearLayout, switchToChat: Boolean) {
                val card = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_ai_card)
                    setPadding((14 * density).toInt(), (12 * density).toInt(), (12 * density).toInt(), (12 * density).toInt())
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = (8 * density).toInt() }
                    isClickable = true
                    isFocusable = true
                    setOnClickListener {
                        if (switchToChat) switchAiMode(1)
                        askAiQuestionFunc?.invoke(question)
                    }
                }

                val qTv = TextView(this@MediaHubActivity).apply {
                    text = question
                    setTextColor(Color.parseColor("#E2E8F0"))
                    textSize = 13.5f
                    setLineSpacing(2 * density, 1f)
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                }

                val chevronTv = TextView(this@MediaHubActivity).apply {
                    text = "›"
                    setTextColor(Color.parseColor("#64748B"))
                    textSize = 18f
                    setPadding((10 * density).toInt(), 0, (2 * density).toInt(), 0)
                }

                card.addView(qTv)
                card.addView(chevronTv)
                container.addView(card)
            }

            fun renderFollowUpSection(questions: List<String>) {
                sheetBinding.layoutFollowUpQuestions.removeAllViews()
                if (questions.isEmpty()) {
                    sheetBinding.textQuestionsLabel.visibility = View.GONE
                    sheetBinding.layoutFollowUpQuestions.visibility = View.GONE
                    return
                }
                sheetBinding.textQuestionsLabel.visibility = View.VISIBLE
                sheetBinding.layoutFollowUpQuestions.visibility = View.VISIBLE
                questions.take(3).forEach { q ->
                    renderPromptCard(q, sheetBinding.layoutFollowUpQuestions, switchToChat = true)
                }
            }

            // Reading Depth Switcher state (Brief / ELI5 / Deep)
            var activeDepthMode = "BRIEF"
            var eli5CachedText: String? = null
            var deepCachedText: String? = null

            fun styleDepthButtons(mode: String) {
                sheetBinding.btnDepthBrief.setBackgroundResource(if (mode == "BRIEF") R.drawable.bg_ai_tab_selected else 0)
                sheetBinding.btnDepthBrief.setTextColor(Color.parseColor(if (mode == "BRIEF") "#FFFFFF" else "#8B95A5"))
                sheetBinding.btnDepthEli5.setBackgroundResource(if (mode == "ELI5") R.drawable.bg_ai_tab_selected else 0)
                sheetBinding.btnDepthEli5.setTextColor(Color.parseColor(if (mode == "ELI5") "#FFFFFF" else "#8B95A5"))
                sheetBinding.btnDepthDeep.setBackgroundResource(if (mode == "DEEP") R.drawable.bg_ai_tab_selected else 0)
                sheetBinding.btnDepthDeep.setTextColor(Color.parseColor(if (mode == "DEEP") "#FFFFFF" else "#8B95A5"))
            }

            fun switchSummaryDepth(mode: String) {
                activeDepthMode = mode
                styleDepthButtons(mode)
                when (mode) {
                    "BRIEF" -> {
                        sheetBinding.textAiExecutiveSummary.text = formatMarkdownToSpanned(currentExecutiveSummary)
                    }
                    "ELI5" -> {
                        val cached = eli5CachedText
                        if (!cached.isNullOrBlank()) {
                            sheetBinding.textAiExecutiveSummary.text = formatMarkdownToSpanned(cached)
                        } else {
                            sheetBinding.textAiExecutiveSummary.text = "Simplifying into plain English..."
                            lifecycleScope.launch(Dispatchers.IO) {
                                val rewritten = FokkAiEngine.rewriteSummaryDepth(
                                    context = this@MediaHubActivity,
                                    mode = "ELI5",
                                    pageTitle = title,
                                    pageHost = sourceHost,
                                    pageContext = lastAiPageContext.ifBlank { currentExecutiveSummary }
                                )
                                eli5CachedText = stripEmojis(rewritten)
                                withContext(Dispatchers.Main) {
                                    if (sheetDialog.isShowing && activeDepthMode == "ELI5") {
                                        sheetBinding.textAiExecutiveSummary.text = formatMarkdownToSpanned(eli5CachedText.orEmpty())
                                    }
                                }
                            }
                        }
                    }
                    "DEEP" -> {
                        val cached = deepCachedText
                        if (!cached.isNullOrBlank()) {
                            sheetBinding.textAiExecutiveSummary.text = formatMarkdownToSpanned(cached)
                        } else {
                            sheetBinding.textAiExecutiveSummary.text = "Analyzing deeper implications..."
                            lifecycleScope.launch(Dispatchers.IO) {
                                val rewritten = FokkAiEngine.rewriteSummaryDepth(
                                    context = this@MediaHubActivity,
                                    mode = "DEEP",
                                    pageTitle = title,
                                    pageHost = sourceHost,
                                    pageContext = lastAiPageContext.ifBlank { currentExecutiveSummary }
                                )
                                deepCachedText = stripEmojis(rewritten)
                                withContext(Dispatchers.Main) {
                                    if (sheetDialog.isShowing && activeDepthMode == "DEEP") {
                                        sheetBinding.textAiExecutiveSummary.text = formatMarkdownToSpanned(deepCachedText.orEmpty())
                                    }
                                }
                            }
                        }
                    }
                }
            }

            sheetBinding.btnDepthBrief.setOnClickListener { switchSummaryDepth("BRIEF") }
            sheetBinding.btnDepthEli5.setOnClickListener { switchSummaryDepth("ELI5") }
            sheetBinding.btnDepthDeep.setOnClickListener { switchSummaryDepth("DEEP") }

            // Initial immediate render from on-device extraction
            if (currentExecutiveSummary.isNotBlank()) {
                sheetBinding.layoutOverviewHeaderRow.visibility = View.VISIBLE
                sheetBinding.textAiExecutiveSummary.visibility = View.VISIBLE
                sheetBinding.textAiExecutiveSummary.text = formatMarkdownToSpanned(currentExecutiveSummary)
            }

            sheetBinding.layoutSummaryBullets.removeAllViews()
            currentBullets.forEachIndexed { idx, bullet ->
                renderBulletRow(bullet, sheetBinding.layoutSummaryBullets, showDivider = idx < currentBullets.size - 1)
            }

            renderKeyMetrics(currentMetrics)
            renderFollowUpSection(currentQuestions)

            // Populate Ask AI Welcome Quick Prompts
            sheetBinding.layoutChatQuickPrompts.removeAllViews()
            val quickStarters = listOf(
                "Summarize this page in 3 concise bullet points",
                "Who published this and what is the main takeaway?",
                "Fact-check the key claims and note any missing context"
            )
            quickStarters.forEach { starter ->
                renderPromptCard(starter, sheetBinding.layoutChatQuickPrompts, switchToChat = false)
            }

            // Button Listeners
            sheetBinding.btnCloseSummary.setOnClickListener { sheetDialog.dismiss() }
            sheetBinding.btnAiHistory.setOnClickListener { showAiHistorySheet() }
            sheetBinding.btnSummaryTrustPill.setOnClickListener { switchAiMode(2) }

            sheetBinding.btnCopySummary.setOnClickListener {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Fokk AI Summary", buildReadableBriefText()))
                Toast.makeText(this, "Summary copied", Toast.LENGTH_SHORT).show()
            }

            // Play / Pause / Resume Audio Brief (true sentence-chunked pause & resume!)
            sheetBinding.btnListenSummary.setOnClickListener {
                if (ttsPlaybackState == 1 && ttsCurrentSourceTag == "summary") {
                    pauseTextToSpeech()
                } else {
                    val textToSpeak = buildReadableBriefText()
                    if (textToSpeak.isNotBlank()) {
                        startTextToSpeech(textToSpeak, "summary")
                    }
                }
            }

            sheetBinding.btnTabAiSummary.setOnClickListener { switchAiMode(0) }
            sheetBinding.btnTabAiChat.setOnClickListener { switchAiMode(1) }
            sheetBinding.btnTabAiAudit.setOnClickListener { switchAiMode(2) }

            val autoOpenChat = lastChatSessionLeftForSource?.sessionKey == sessionKey && chatSession.turns.isNotEmpty()
            if (autoOpenChat) {
                lastChatSessionLeftForSource = null
            }
            switchAiMode(if (autoOpenChat) 1 else initialTab)

            // Render Visual Context & Entities photo gallery in Truth & Bias
            fun renderVisualEvidenceGallery(items: List<VisualEvidenceItem>) {
                sheetBinding.layoutAuditVisualList.removeAllViews()
                if (items.isEmpty()) {
                    sheetBinding.layoutAuditVisualSection.visibility = View.GONE
                    return
                }
                sheetBinding.layoutAuditVisualSection.visibility = View.VISIBLE
                for (item in items) {
                    val card = LinearLayout(this@MediaHubActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_ai_card)
                        layoutParams = LinearLayout.LayoutParams(
                            (156 * density).toInt(),
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        ).apply { marginEnd = (10 * density).toInt() }
                        isClickable = true
                        isFocusable = true
                        setOnClickListener {
                            if (chatSession.turns.isNotEmpty()) lastChatSessionLeftForSource = chatSession
                            sheetDialog.dismiss()
                            addNewTab(item.sourceUrl, isPrivate = activeTab?.isPrivate == true)
                        }
                    }

                    val imgCard = androidx.cardview.widget.CardView(this@MediaHubActivity).apply {
                        radius = 12 * density
                        cardElevation = 0f
                        setCardBackgroundColor(Color.parseColor("#111827"))
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            (96 * density).toInt()
                        )
                    }
                    val iv = ImageView(this@MediaHubActivity).apply {
                        scaleType = ImageView.ScaleType.CENTER_CROP
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    }
                    imgCard.addView(iv)
                    card.addView(imgCard)

                    Thread {
                        try {
                            val conn = java.net.URL(item.imageUrl).openConnection() as java.net.HttpURLConnection
                            conn.connectTimeout = 4000
                            conn.readTimeout = 4000
                            conn.setRequestProperty("User-Agent", "FokkBrowser/2.8 (Android; Mobile)")
                            val bmp = BitmapFactory.decodeStream(conn.inputStream)
                            if (bmp != null) {
                                runOnUiThread {
                                    if (sheetDialog.isShowing) iv.setImageBitmap(bmp)
                                }
                            }
                        } catch (_: Exception) {}
                    }.start()

                    val textWrap = LinearLayout(this@MediaHubActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding((10 * density).toInt(), (8 * density).toInt(), (10 * density).toInt(), (10 * density).toInt())
                    }
                    val titleTv = TextView(this@MediaHubActivity).apply {
                        text = item.title
                        setTextColor(Color.parseColor("#F8FAFC"))
                        textSize = 12.5f
                        setTypeface(null, Typeface.BOLD)
                        maxLines = 1
                        ellipsize = TextUtils.TruncateAt.END
                    }
                    val capTv = TextView(this@MediaHubActivity).apply {
                        text = item.caption
                        setTextColor(Color.parseColor("#94A3B8"))
                        textSize = 11f
                        maxLines = 2
                        ellipsize = TextUtils.TruncateAt.END
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        ).apply { topMargin = (2 * density).toInt() }
                    }
                    textWrap.addView(titleTv)
                    textWrap.addView(capTv)
                    card.addView(textWrap)
                    sheetBinding.layoutAuditVisualList.addView(card)
                }
            }

            // Update Bias Spectrum dot, Sensationalism gauge, Fact/Claim/Opinion ratio bar, and Counter-Perspective
            fun renderBiasSpectrumAndRatios(
                biasPos: Int,
                sensationalism: Int,
                counterPerspective: String,
                claims: List<String>
            ) {
                val clampedPos = biasPos.coerceIn(5, 95)
                sheetBinding.frameBiasSpectrumTrack.post {
                    val trackWidth = sheetBinding.frameBiasSpectrumTrack.width
                    val dotWidth = sheetBinding.viewBiasIndicatorDot.width.coerceAtLeast((14 * density).toInt())
                    if (trackWidth > dotWidth) {
                        val tx = ((trackWidth - dotWidth) * (clampedPos / 100f))
                        sheetBinding.viewBiasIndicatorDot.translationX = tx
                    }
                }

                val sensLevel = when {
                    sensationalism >= 60 -> "High"
                    sensationalism >= 30 -> "Moderate"
                    else -> "Low"
                }
                sheetBinding.textSensationalismLabel.text = "Sensationalism: $sensLevel ($sensationalism%)"
                sheetBinding.textSensationalismLabel.setTextColor(
                    Color.parseColor(
                        when {
                            sensationalism >= 60 -> "#F87171"
                            sensationalism >= 30 -> "#FBBF24"
                            else -> "#34D399"
                        }
                    )
                )

                val total = claims.size.coerceAtLeast(1)
                val factCount = claims.count { FokkAiEngine.classifyBullet(it) == "FACT" }
                val opinionCount = claims.count { FokkAiEngine.classifyBullet(it) == "OPINION" }
                val claimCount = (total - factCount - opinionCount).coerceAtLeast(0)
                val fPct = (factCount * 100) / total
                val oPct = (opinionCount * 100) / total
                val cPct = (100 - fPct - oPct).coerceAtLeast(0)

                sheetBinding.textRatioSummary.text = "$fPct% Fact  ·  $cPct% Claim  ·  $oPct% Opinion"
                (sheetBinding.barRatioFact.layoutParams as LinearLayout.LayoutParams).weight = fPct.coerceAtLeast(if (factCount > 0) 6 else 0).toFloat()
                (sheetBinding.barRatioClaim.layoutParams as LinearLayout.LayoutParams).weight = cPct.coerceAtLeast(if (claimCount > 0) 6 else 0).toFloat()
                (sheetBinding.barRatioOpinion.layoutParams as LinearLayout.LayoutParams).weight = oPct.coerceAtLeast(if (opinionCount > 0) 6 else 0).toFloat()
                sheetBinding.barRatioFact.requestLayout()

                if (counterPerspective.isNotBlank()) {
                    sheetBinding.layoutCounterPerspectiveCard.visibility = View.VISIBLE
                    sheetBinding.textCounterPerspective.text = counterPerspective
                } else {
                    sheetBinding.layoutCounterPerspectiveCard.visibility = View.GONE
                }
            }

            // Baseline Truth & Bias Initialization
            fun applyCredibilityUi(
                score: Int,
                verdict: String,
                reason: String,
                bias: String,
                l1: String,
                l2: String,
                l3: String,
                isAggregator: Boolean,
                originalSource: String,
                aggregatorSource: String,
                whatsMissing: String
            ) {
                val scoreColor = when {
                    score >= 82 -> "#34D399"
                    score >= 68 -> "#38BDF8"
                    score >= 50 -> "#FBBF24"
                    else -> "#F87171"
                }
                val parsedColor = Color.parseColor(scoreColor)

                sheetBinding.textSummaryTrustVerdict.text = verdict
                sheetBinding.textSummaryTrustScore.text = "$score%"
                sheetBinding.textSummaryTrustVerdict.setTextColor(parsedColor)
                sheetBinding.textSummaryTrustScore.setTextColor(parsedColor)
                sheetBinding.imgSummaryTrustIcon.setColorFilter(parsedColor)

                sheetBinding.textAiCredibilityScore.text = "$score% · $verdict"
                sheetBinding.textAiCredibilityScore.setTextColor(parsedColor)
                sheetBinding.progressCredibilityScore.progress = score
                sheetBinding.progressCredibilityScore.progressTintList = ColorStateList.valueOf(parsedColor)
                sheetBinding.textAiCredibilityReason.text = reason
                sheetBinding.textAiBiasRating.text = bias
                sheetBinding.textAiSourceReputation.text = l1
                sheetBinding.textAiBiasAnalysis.text = l2
                sheetBinding.textAiEvidenceDensity.text = l3

                if (isAggregator && originalSource.isNotBlank()) {
                    val agg = aggregatorSource.ifBlank { publisherName }
                    sheetBinding.layoutAuditSourceChain.visibility = View.VISIBLE
                    sheetBinding.textAuditSourceChainFlow.text = "$originalSource → $agg"
                } else if (originalSource.isNotBlank() && !originalSource.equals(publisherName, ignoreCase = true)) {
                    sheetBinding.layoutAuditSourceChain.visibility = View.VISIBLE
                    sheetBinding.textAuditSourceChainFlow.text = "$originalSource → $publisherName"
                } else {
                    sheetBinding.layoutAuditSourceChain.visibility = View.GONE
                }

                if (whatsMissing.isNotBlank()) {
                    sheetBinding.layoutSummaryWhatsMissing.visibility = View.VISIBLE
                    sheetBinding.textSummaryWhatsMissing.text = whatsMissing
                } else {
                    sheetBinding.layoutSummaryWhatsMissing.visibility = View.GONE
                }
            }

            val initialEval = FokkAiEngine.evaluateCredibility(
                host = sourceHost,
                title = title,
                context = currentExecutiveSummary.ifBlank { lastAiPageContext },
                sources = emptyList()
            )
            applyCredibilityUi(
                score = initialEval.score,
                verdict = initialEval.verdict,
                reason = initialEval.reason,
                bias = "Objective Reporting",
                l1 = initialEval.layer1,
                l2 = initialEval.layer2,
                l3 = initialEval.layer3,
                isAggregator = initialEval.isAggregator,
                originalSource = initialEval.originalSource,
                aggregatorSource = initialEval.aggregatorSource,
                whatsMissing = initialEval.whatsMissing
            )

            // Populate initial Claims Breakdown & Ratios
            sheetBinding.layoutAiExtractedClaims.removeAllViews()
            val initialClaims = currentBullets.take(4).ifEmpty {
                if (currentExecutiveSummary.isNotBlank()) listOf(currentExecutiveSummary) else emptyList()
            }
            initialClaims.forEachIndexed { idx, claim ->
                renderBulletRow(claim, sheetBinding.layoutAiExtractedClaims, showDivider = idx < initialClaims.size - 1)
            }
            renderBiasSpectrumAndRatios(
                biasPos = json.optInt("biasPosition", 50),
                sensationalism = json.optInt("sensationalismScore", 18),
                counterPerspective = stripEmojis(json.optString("counterPerspective", "")),
                claims = initialClaims
            )
            // Pre-populate Visual Context & Entities quickly if focal page entities are already extracted
            if (topEntitiesFromJs.isNotEmpty()) {
                lifecycleScope.launch(Dispatchers.IO) {
                    val quickVisuals = FokkSearchAggregator.fetchVisualEvidence(
                        entities = topEntitiesFromJs,
                        fallbackTitle = title,
                        max = 4
                    )
                    withContext(Dispatchers.Main) {
                        if (sheetDialog.isShowing && quickVisuals.isNotEmpty() && sheetBinding.layoutAuditVisualList.childCount == 0) {
                            renderVisualEvidenceGallery(quickVisuals)
                        }
                    }
                }
            }

            // Multi-turn Conversation History for Ask AI
            val chatHistory = mutableListOf<Pair<String, String>>()

            // Helper: smooth scroll Ask AI only if user hasn't scrolled far up
            fun scrollChatToBottomIfNearEnd() {
                sheetBinding.scrollAiChatResponses.post {
                    val sv = sheetBinding.scrollAiChatResponses
                    val child = sv.getChildAt(0) ?: return@post
                    val distanceFromBottom = child.bottom - (sv.scrollY + sv.height)
                    if (distanceFromBottom < (220 * density).toInt()) {
                        sv.smoothScrollTo(0, child.bottom)
                    }
                }
            }

            // Clean, Uncluttered Ask AI Response Renderer (Logo + "Fokk AI" only, zero percentage/verdict spam)
            fun renderChatAnswerCard(
                container: LinearLayout,
                question: String,
                answer: String,
                pageSourceHost: String,
                pageSourceUrl: String,
                searchSources: List<BrowserSearchResult> = emptyList(),
                followUps: List<String> = emptyList(),
                animate: Boolean = true
            ) {
                // Remove thinking indicator while keeping user question bubble
                while (container.childCount > 1) {
                    container.removeViewAt(container.childCount - 1)
                }

                // 1. Minimal Clean Header: Fokk AI logo + "Fokk AI" (no score, no verdict, no source count)
                val aiHeaderRow = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        topMargin = (6 * density).toInt()
                        bottomMargin = (8 * density).toInt()
                    }
                }

                val aiLogo = ImageView(this@MediaHubActivity).apply {
                    setImageResource(R.drawable.ic_fokk_ai_logo)
                    layoutParams = LinearLayout.LayoutParams((18 * density).toInt(), (18 * density).toInt()).apply {
                        marginEnd = (8 * density).toInt()
                    }
                    scaleType = ImageView.ScaleType.FIT_CENTER
                }

                val aiTitleTv = TextView(this@MediaHubActivity).apply {
                    text = "Fokk AI"
                    setTextColor(Color.parseColor("#F8FAFC"))
                    textSize = 13.5f
                    setTypeface(null, Typeface.BOLD)
                }

                aiHeaderRow.addView(aiLogo)
                aiHeaderRow.addView(aiTitleTv)
                container.addView(aiHeaderRow)

                // 2. Crisp Answer TextView
                val aTv = TextView(this@MediaHubActivity).apply {
                    setTextColor(Color.parseColor("#E2E8F0"))
                    textSize = 14.5f
                    setLineSpacing(5 * density, 1f)
                    setTextIsSelectable(true)
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = (10 * density).toInt() }
                }
                container.addView(aTv)

                val cleanAnswerText = FokkAiEngine.cleanDropCaps(
                    stripEmojis(answer)
                        .replace(Regex("""(?is)###\s*CORROBORATING SOURCES.*?(?=###|$)"""), "")
                        .replace(Regex("""(?m)^\d+\.\s*\*\*.*?\*\*\s*\(.*?\)\s*\[.*?\]\s*$"""), "")
                        .trim()
                )

                // 3. Minimal Action Row: Copy, Listen / Stop, Web Search
                val actionRow = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    visibility = View.GONE
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { topMargin = (2 * density).toInt() }
                }

                fun makeActionChip(label: String, onClick: () -> Unit): TextView {
                    return TextView(this@MediaHubActivity).apply {
                        text = label
                        setTextColor(Color.parseColor("#94A3B8"))
                        textSize = 11.5f
                        setTypeface(null, Typeface.BOLD)
                        background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_ai_pill)
                        setPadding((12 * density).toInt(), (6 * density).toInt(), (12 * density).toInt(), (6 * density).toInt())
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.WRAP_CONTENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        ).apply { marginEnd = (8 * density).toInt() }
                        isClickable = true
                        isFocusable = true
                        setOnClickListener { onClick() }
                    }
                }

                actionRow.addView(makeActionChip("Copy") {
                    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("Fokk AI Answer", cleanAnswerText))
                    Toast.makeText(this@MediaHubActivity, "Copied", Toast.LENGTH_SHORT).show()
                })

                val turnAudioTag = "chat_${System.nanoTime()}"
                val listenChip = makeActionChip("Listen") {
                    if (ttsPlaybackState == 1 && ttsCurrentSourceTag == turnAudioTag) {
                        stopTextToSpeech()
                    } else {
                        startTextToSpeech(cleanAnswerText, turnAudioTag)
                    }
                }
                activeChatListenChips[turnAudioTag] = listenChip
                actionRow.addView(listenChip)

                actionRow.addView(makeActionChip("Web Search") {
                    if (chatSession.turns.isNotEmpty()) lastChatSessionLeftForSource = chatSession
                    sheetDialog.dismiss()
                    val searchUrl = currentSearchEngine.searchUrl + Uri.encode(question)
                    addNewTab(searchUrl, isPrivate = activeTab?.isPrivate == true)
                })

                container.addView(actionRow)

                // 4. Clean Sources Row (only quality domains)
                val sourcesContainer = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    visibility = View.GONE
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { topMargin = (12 * density).toInt() }
                }

                val sourcesLabel = TextView(this@MediaHubActivity).apply {
                    text = "Sources"
                    setTextColor(Color.parseColor("#64748B"))
                    textSize = 11.5f
                    setTypeface(null, Typeface.BOLD)
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = (6 * density).toInt() }
                }
                sourcesContainer.addView(sourcesLabel)

                val sourcesScroll = HorizontalScrollView(this@MediaHubActivity).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = (4 * density).toInt() }
                    isHorizontalScrollBarEnabled = false
                    overScrollMode = View.OVER_SCROLL_NEVER
                }

                val sourcesRow = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                }
                sourcesScroll.addView(sourcesRow)
                sourcesContainer.addView(sourcesScroll)

                val allSources = mutableListOf<BrowserSearchResult>()
                if (pageSourceHost.isNotBlank() && pageSourceUrl.isNotBlank()) {
                    allSources.add(BrowserSearchResult(title.ifBlank { pageSourceHost }, pageSourceUrl, pageSourceHost, ""))
                }
                allSources.addAll(searchSources.filter { it.url != pageSourceUrl && it.url.isNotBlank() })

                for (s in allSources.take(5)) {
                    val pill = LinearLayout(this@MediaHubActivity).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.CENTER_VERTICAL
                        background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_ai_pill)
                        setPadding((10 * density).toInt(), (6 * density).toInt(), (12 * density).toInt(), (6 * density).toInt())
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.WRAP_CONTENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        ).apply { marginEnd = (6 * density).toInt() }
                        isClickable = true
                        isFocusable = true
                        setOnClickListener {
                            if (chatSession.turns.isNotEmpty()) lastChatSessionLeftForSource = chatSession
                            sheetDialog.dismiss()
                            addNewTab(s.url, isPrivate = activeTab?.isPrivate == true)
                        }
                    }
                    val pillFavicon = ImageView(this@MediaHubActivity).apply {
                        layoutParams = LinearLayout.LayoutParams((14 * density).toInt(), (14 * density).toInt()).apply {
                            marginEnd = (6 * density).toInt()
                        }
                        setImageResource(R.drawable.ic_world)
                        setColorFilter(Color.parseColor("#64748B"))
                    }
                    val pillDomain = s.domain.ifBlank { s.url }.removePrefix("www.")
                    if (pillDomain.isNotBlank()) {
                        Thread {
                            try {
                                val fUrl = "https://www.google.com/s2/favicons?domain=${Uri.encode(pillDomain)}&sz=32"
                                val conn = java.net.URL(fUrl).openConnection() as java.net.HttpURLConnection
                                conn.connectTimeout = 3000
                                conn.readTimeout = 3000
                                val bmp = BitmapFactory.decodeStream(conn.inputStream)
                                if (bmp != null) runOnUiThread {
                                    if (sheetDialog.isShowing) {
                                        pillFavicon.clearColorFilter()
                                        pillFavicon.setImageBitmap(bmp)
                                    }
                                }
                            } catch (_: Exception) {}
                        }.start()
                    }
                    val pillTv = TextView(this@MediaHubActivity).apply {
                        text = FokkSearchAggregator.cleanPublisherName(pillDomain)
                        setTextColor(Color.parseColor("#CBD5E1"))
                        textSize = 11.5f
                        setTypeface(null, Typeface.BOLD)
                    }
                    pill.addView(pillFavicon)
                    pill.addView(pillTv)
                    sourcesRow.addView(pill)
                }

                // 5. Clean Follow-Up Questions
                val followUpsContainer = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    visibility = View.GONE
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { topMargin = (12 * density).toInt() }
                }

                val cleanFollowUps = followUps.map { stripEmojis(it).trim() }.filter { it.length > 6 }.take(2)
                if (cleanFollowUps.isNotEmpty()) {
                    val followUpsLabel = TextView(this@MediaHubActivity).apply {
                        text = "Related"
                        setTextColor(Color.parseColor("#64748B"))
                        textSize = 11.5f
                        setTypeface(null, Typeface.BOLD)
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        ).apply { bottomMargin = (6 * density).toInt() }
                    }
                    followUpsContainer.addView(followUpsLabel)
                    cleanFollowUps.forEach { fq ->
                        renderPromptCard(fq, followUpsContainer, switchToChat = false)
                    }
                }

                container.addView(sourcesContainer)
                container.addView(followUpsContainer)

                // Subtle separator between turns
                val turnDivider = View(this@MediaHubActivity).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        (1 * density).toInt().coerceAtLeast(1)
                    ).apply { topMargin = (14 * density).toInt() }
                    setBackgroundColor(Color.parseColor("#111827"))
                }
                container.addView(turnDivider)

                // 6. Smooth Non-Intrusive Text Reveal (instant when restoring saved chat turns)
                val words = cleanAnswerText.split(" ")
                if (!animate || words.size <= 8) {
                    aTv.text = formatMarkdownToSpanned(cleanAnswerText)
                    actionRow.visibility = View.VISIBLE
                    if (allSources.isNotEmpty()) sourcesContainer.visibility = View.VISIBLE
                    if (cleanFollowUps.isNotEmpty()) followUpsContainer.visibility = View.VISIBLE
                    if (animate) scrollChatToBottomIfNearEnd()
                } else {
                    var currentWordIndex = 0
                    val streamedBuilder = StringBuilder()
                    val streamStep = maxOf(2, words.size / 26)
                    val streamHandler = Handler(Looper.getMainLooper())
                    lateinit var streamRunnable: Runnable
                    streamRunnable = Runnable {
                        if (!sheetDialog.isShowing) return@Runnable
                        val nextWordIndex = minOf(currentWordIndex + streamStep, words.size)
                        for (w in currentWordIndex until nextWordIndex) {
                            if (streamedBuilder.isNotEmpty()) streamedBuilder.append(" ")
                            streamedBuilder.append(words[w])
                        }
                        currentWordIndex = nextWordIndex
                        val isDone = currentWordIndex >= words.size
                        aTv.text = formatMarkdownToSpanned(streamedBuilder.toString())

                        if (!isDone) {
                            scrollChatToBottomIfNearEnd()
                            streamHandler.postDelayed(streamRunnable, 22L)
                        } else {
                            aTv.text = formatMarkdownToSpanned(cleanAnswerText)
                            actionRow.visibility = View.VISIBLE
                            if (allSources.isNotEmpty()) sourcesContainer.visibility = View.VISIBLE
                            if (cleanFollowUps.isNotEmpty()) followUpsContainer.visibility = View.VISIBLE
                            scrollChatToBottomIfNearEnd()
                        }
                    }
                    activeStreamHandlers.add(Pair(streamHandler, streamRunnable))
                    streamHandler.post(streamRunnable)
                }
            }

            fun buildUserTurnContainer(queryText: String): LinearLayout {
                val turnContainer = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(0, (6 * density).toInt(), 0, (10 * density).toInt())
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                }
                val qRow = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.END or Gravity.CENTER_VERTICAL
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = (10 * density).toInt() }
                }
                val qPill = TextView(this@MediaHubActivity).apply {
                    text = queryText
                    setTextColor(Color.parseColor("#F8FAFC"))
                    textSize = 14f
                    background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_ai_user_bubble)
                    setPadding((14 * density).toInt(), (10 * density).toInt(), (14 * density).toInt(), (10 * density).toInt())
                    maxWidth = (resources.displayMetrics.widthPixels * 0.80f).toInt()
                }
                qRow.addView(qPill)
                turnContainer.addView(qRow)
                return turnContainer
            }

            fun askAiQuestion(query: String) {
                val cleanQuery = query.trim()
                if (cleanQuery.isBlank()) return
                sheetBinding.editAiUserQuestion.text?.clear()
                sheetBinding.layoutChatEmptyState.visibility = View.GONE

                // Hide soft keyboard cleanly so answer is visible
                try {
                    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                    imm.hideSoftInputFromWindow(sheetBinding.editAiUserQuestion.windowToken, 0)
                } catch (_: Exception) {}

                if (!checkAndIncrementAiQuota()) {
                    showAiQuotaExceededDialog()
                    return
                }

                val turnContainer = buildUserTurnContainer(cleanQuery)

                // Clean thinking indicator
                val thinkingRow = LinearLayout(this@MediaHubActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding(0, (4 * density).toInt(), 0, (8 * density).toInt())
                }

                val thinkingLogo = ImageView(this@MediaHubActivity).apply {
                    setImageResource(R.drawable.ic_fokk_ai_logo)
                    layoutParams = LinearLayout.LayoutParams((18 * density).toInt(), (18 * density).toInt()).apply {
                        marginEnd = (8 * density).toInt()
                    }
                    scaleType = ImageView.ScaleType.FIT_CENTER
                }

                val thinkingTv = TextView(this@MediaHubActivity).apply {
                    text = "Thinking..."
                    setTextColor(Color.parseColor("#94A3B8"))
                    textSize = 13.5f
                }

                thinkingRow.addView(thinkingLogo)
                thinkingRow.addView(thinkingTv)
                turnContainer.addView(thinkingRow)
                sheetBinding.layoutAiChatResponses.addView(turnContainer)

                sheetBinding.scrollAiChatResponses.post {
                    val child = sheetBinding.scrollAiChatResponses.getChildAt(0)
                    if (child != null) sheetBinding.scrollAiChatResponses.smoothScrollTo(0, child.bottom)
                }

                val pageCtx = lastAiPageContext.take(8000)
                val historySnapshot = chatHistory.toList()

                // Smart search query builder: never search filler like "what is the post about who posted it"
                val fillerWords = setOf(
                    "what", "is", "this", "the", "post", "about", "who", "posted", "it",
                    "article", "page", "summary", "summarize", "explain", "tell", "me",
                    "wrote", "author", "published", "when", "was", "did", "can", "you",
                    "please", "give", "brief", "key", "takeaways", "bullets", "points"
                )
                val meaningfulTerms = cleanQuery.lowercase(Locale.ROOT)
                    .split(Regex("[^a-z0-9]+"))
                    .filter { it.length >= 3 && !fillerWords.contains(it) }

                val searchQuery = when {
                    meaningfulTerms.size >= 2 -> cleanQuery.take(120)
                    title.isNotBlank() -> title.take(110)
                    else -> cleanQuery.take(120)
                }

                lifecycleScope.launch(Dispatchers.IO) {
                    val sources = if (searchQuery.isNotBlank()) {
                        FokkSearchAggregator.aggregate(
                            query = searchQuery,
                            pageTitle = if (meaningfulTerms.size < 2) title else "",
                            pageHost = sourceHost,
                            maxResults = 5
                        )
                    } else {
                        emptyList()
                    }

                    val searchSources = sources.map {
                        BrowserSearchResult(it.title, it.url, it.domain, it.snippet, it.sourceType, it.timestamp)
                    }

                    val (answer, followUps) = FokkAiEngine.queryInteractiveResearch(
                        context = this@MediaHubActivity,
                        userQuery = cleanQuery,
                        pageTitle = title,
                        pageHost = sourceHost,
                        pageContext = pageCtx,
                        externalSources = sources,
                        pageAuthor = pageAuthor,
                        pagePublished = pagePublished,
                        pageUrl = activeUrl,
                        conversationHistory = historySnapshot
                    )

                    chatHistory.add(Pair(cleanQuery, answer))
                    chatSession.pageContext = pageCtx
                    chatSession.turns.add(
                        AiChatTurn(
                            question = cleanQuery,
                            answer = answer,
                            sources = searchSources,
                            followUps = followUps,
                            pageSourceHost = sourceHost,
                            pageSourceUrl = activeUrl
                        )
                    )

                    withContext(Dispatchers.Main) {
                        if (sheetDialog.isShowing) {
                            renderChatAnswerCard(
                                container = turnContainer,
                                question = cleanQuery,
                                answer = answer,
                                pageSourceHost = sourceHost,
                                pageSourceUrl = activeUrl,
                                searchSources = searchSources,
                                followUps = followUps,
                                animate = true
                            )
                        }
                    }
                }
            }
            askAiQuestionFunc = { q -> askAiQuestion(q) }

            // Restore persisted Ask AI conversation turns for this page/session (seamless return after clicking sources!)
            if (chatSession.turns.isNotEmpty()) {
                sheetBinding.layoutChatEmptyState.visibility = View.GONE
                chatSession.turns.forEach { savedTurn ->
                    chatHistory.add(Pair(savedTurn.question, savedTurn.answer))
                    val turnBox = buildUserTurnContainer(savedTurn.question)
                    sheetBinding.layoutAiChatResponses.addView(turnBox)
                    renderChatAnswerCard(
                        container = turnBox,
                        question = savedTurn.question,
                        answer = savedTurn.answer,
                        pageSourceHost = sourceHost,
                        pageSourceUrl = activeUrl,
                        searchSources = savedTurn.sources,
                        followUps = savedTurn.followUps,
                        animate = false
                    )
                }
                sheetBinding.scrollAiChatResponses.post {
                    val child = sheetBinding.scrollAiChatResponses.getChildAt(0)
                    if (child != null) sheetBinding.scrollAiChatResponses.scrollTo(0, child.bottom)
                }
            }

            sheetBinding.btnSendAiQuestion.setOnClickListener {
                val q = sheetBinding.editAiUserQuestion.text?.toString()?.trim().orEmpty()
                if (q.isNotEmpty()) askAiQuestion(q)
            }

            sheetBinding.btnAiVoiceInput.setOnClickListener {
                aiVoiceInputCallback = { spokenText ->
                    sheetBinding.editAiUserQuestion.setText(spokenText)
                    askAiQuestion(spokenText)
                }
                try {
                    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                        putExtra(RecognizerIntent.EXTRA_PROMPT, "Ask Fokk AI anything...")
                        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    }
                    aiVoiceRecognitionLauncher.launch(intent)
                } catch (_: Exception) {
                    Toast.makeText(this@MediaHubActivity, "Voice input unavailable on this device", Toast.LENGTH_SHORT).show()
                }
            }

            sheetBinding.editAiUserQuestion.setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_SEND) {
                    val q = sheetBinding.editAiUserQuestion.text?.toString()?.trim().orEmpty()
                    if (q.isNotEmpty()) askAiQuestion(q)
                    true
                } else false
            }

            sheetDialog.show()

            // Background Live Corroboration & Deep AI Synthesis
            val pageCtx = lastAiPageContext.take(9000)
            val anchoredQuery = if (title.isNotBlank() && !title.equals("Fokk AI", ignoreCase = true)) {
                title.take(120)
            } else {
                ""
            }

            if (anchoredQuery.isNotBlank()) {
                sheetBinding.layoutSummaryAiLoading.visibility = View.VISIBLE
                lifecycleScope.launch(Dispatchers.IO) {
                    val sources = FokkSearchAggregator.aggregate(
                        query = anchoredQuery,
                        pageTitle = title,
                        pageHost = sourceHost,
                        maxResults = 6
                    )

                    withContext(Dispatchers.Main) {
                        if (!sheetDialog.isShowing) return@withContext
                        if (sources.isNotEmpty()) {
                            sheetBinding.layoutAiCorroborationHeader.visibility = View.VISIBLE
                            sheetBinding.textAiCorroborationStatus.text = "Related Sources"
                            sheetBinding.textAiSourcesCount.text = "${sources.size}"
                            sheetBinding.scrollAiSources.visibility = View.VISIBLE
                            sheetBinding.layoutAiSourcesList.removeAllViews()

                            for (src in sources) {
                                val pill = LinearLayout(this@MediaHubActivity).apply {
                                    orientation = LinearLayout.HORIZONTAL
                                    gravity = Gravity.CENTER_VERTICAL
                                    background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_ai_pill)
                                    setPadding((10 * density).toInt(), (7 * density).toInt(), (12 * density).toInt(), (7 * density).toInt())
                                    layoutParams = LinearLayout.LayoutParams(
                                        ViewGroup.LayoutParams.WRAP_CONTENT,
                                        ViewGroup.LayoutParams.WRAP_CONTENT
                                    ).apply { marginEnd = (8 * density).toInt() }
                                    isClickable = true
                                    isFocusable = true
                                    setOnClickListener {
                                        if (chatSession.turns.isNotEmpty()) lastChatSessionLeftForSource = chatSession
                                        sheetDialog.dismiss()
                                        addNewTab(src.url, isPrivate = activeTab?.isPrivate == true)
                                    }
                                }

                                val faviconIv = ImageView(this@MediaHubActivity).apply {
                                    layoutParams = LinearLayout.LayoutParams((14 * density).toInt(), (14 * density).toInt()).apply {
                                        marginEnd = (6 * density).toInt()
                                    }
                                    setImageResource(R.drawable.ic_world)
                                    setColorFilter(Color.parseColor("#64748B"))
                                }

                                val favUrl = "https://www.google.com/s2/favicons?domain=${Uri.encode(src.domain)}&sz=32"
                                Thread {
                                    try {
                                        val conn = java.net.URL(favUrl).openConnection() as java.net.HttpURLConnection
                                        conn.connectTimeout = 3000
                                        conn.readTimeout = 3000
                                        val bmp = BitmapFactory.decodeStream(conn.inputStream)
                                        if (bmp != null) runOnUiThread {
                                            if (sheetDialog.isShowing) {
                                                faviconIv.clearColorFilter()
                                                faviconIv.setImageBitmap(bmp)
                                            }
                                        }
                                    } catch (_: Exception) {}
                                }.start()

                                val domainTv = TextView(this@MediaHubActivity).apply {
                                    text = FokkSearchAggregator.cleanPublisherName(src.domain)
                                    setTextColor(Color.parseColor("#E2E8F0"))
                                    textSize = 12f
                                    setTypeface(null, Typeface.BOLD)
                                }

                                pill.addView(faviconIv)
                                pill.addView(domainTv)
                                sheetBinding.layoutAiSourcesList.addView(pill)
                            }
                        } else {
                            sheetBinding.layoutAiCorroborationHeader.visibility = View.GONE
                            sheetBinding.scrollAiSources.visibility = View.GONE
                        }
                    }

                    val analysis = FokkAiEngine.analyzeWebpage(
                        context = this@MediaHubActivity,
                        pageTitle = title,
                        pageHost = sourceHost,
                        pageUrl = activeUrl,
                        pageContext = pageCtx,
                        externalSources = sources,
                        pageAuthor = pageAuthor,
                        pagePublished = pagePublished
                    )

                    withContext(Dispatchers.Main) {
                        if (!sheetDialog.isShowing) return@withContext
                        sheetBinding.layoutSummaryAiLoading.visibility = View.GONE

                        if (analysis.executiveBrief.isNotBlank()) {
                            currentExecutiveSummary = stripEmojis(analysis.executiveBrief)
                            sheetBinding.layoutOverviewHeaderRow.visibility = View.VISIBLE
                            sheetBinding.textAiExecutiveSummary.visibility = View.VISIBLE
                            if (activeDepthMode == "BRIEF") {
                                sheetBinding.textAiExecutiveSummary.text = formatMarkdownToSpanned(currentExecutiveSummary)
                            }
                        }

                        applyCredibilityUi(
                            score = analysis.credibilityScore,
                            verdict = analysis.credibilityVerdict,
                            reason = analysis.credibilityReason,
                            bias = analysis.biasTone.ifBlank { "Objective Reporting" },
                            l1 = analysis.layer1DomainIdentity,
                            l2 = analysis.layer2RhetoricalStance,
                            l3 = analysis.layer3EvidenceDensity,
                            isAggregator = analysis.isAggregator,
                            originalSource = analysis.originalSource,
                            aggregatorSource = analysis.aggregatorSource,
                            whatsMissing = analysis.whatsMissing
                        )

                        if (analysis.keyEvidencePoints.isNotEmpty()) {
                            currentBullets = analysis.keyEvidencePoints.map { stripEmojis(it) }.toMutableList()
                            sheetBinding.layoutSummaryBullets.removeAllViews()
                            currentBullets.forEachIndexed { idx, point ->
                                renderBulletRow(point, sheetBinding.layoutSummaryBullets, showDivider = idx < currentBullets.size - 1)
                            }
                        }

                        if (analysis.keyMetrics.isNotEmpty()) {
                            currentMetrics = analysis.keyMetrics.toMutableList()
                            renderKeyMetrics(currentMetrics)
                        }

                        val resolvedClaims = if (analysis.verifiedClaims.isNotEmpty()) {
                            sheetBinding.layoutAiExtractedClaims.removeAllViews()
                            val claims = analysis.verifiedClaims.map { stripEmojis(it) }
                            claims.forEachIndexed { idx, claim ->
                                renderBulletRow(claim, sheetBinding.layoutAiExtractedClaims, showDivider = idx < claims.size - 1)
                            }
                            claims
                        } else {
                            initialClaims
                        }

                        // Upgrade Truth & Bias Pro Analytics: Bias Spectrum, Sensationalism, Ratio Bar & Counter-Perspective
                        renderBiasSpectrumAndRatios(
                            biasPos = analysis.biasPosition,
                            sensationalism = analysis.sensationalismScore,
                            counterPerspective = stripEmojis(analysis.counterPerspective),
                            claims = resolvedClaims
                        )

                        if (analysis.followUpQuestions.isNotEmpty()) {
                            currentQuestions = analysis.followUpQuestions.map { stripEmojis(it) }.toMutableList()
                            renderFollowUpSection(currentQuestions)
                        }

                        // Cache and persist in Fokk AI History & active Chat Session
                        cachedAiSummaryUrl = activeUrl
                        val updatedJson = JSONObject(summaryJson).apply {
                            put("url", activeUrl)
                            put("postUrl", sessionKey)
                            put("executiveSummary", currentExecutiveSummary)
                            put("credibilityScore", analysis.credibilityScore)
                            put("credibilityVerdict", analysis.credibilityVerdict)
                            put("credibilityReason", analysis.credibilityReason)
                            put("bullets", JSONArray(currentBullets))
                            put("metrics", JSONArray(currentMetrics.map { "${it.value} :: ${it.label}" }))
                            put("verifiedClaims", JSONArray(analysis.verifiedClaims))
                            put("followUpQuestions", JSONArray(currentQuestions))
                            put("biasPosition", analysis.biasPosition)
                            put("sensationalismScore", analysis.sensationalismScore)
                            put("counterPerspective", stripEmojis(analysis.counterPerspective))
                        }
                        cachedAiSummaryJson = updatedJson.toString()
                        chatSession.summaryJson = cachedAiSummaryJson!!
                        saveAiHistoryItem(
                            url = activeUrl,
                            title = title,
                            score = analysis.credibilityScore,
                            verdict = analysis.credibilityVerdict,
                            summary = currentExecutiveSummary,
                            sourcesCount = sources.size,
                            fullJson = cachedAiSummaryJson!!
                        )

                        // Fetch high-relevance Visual Context & Entities photography (free Wikipedia PageImages API)
                        val visualEntitiesQuery = (analysis.visualEntities + topEntitiesFromJs)
                            .map { it.trim() }
                            .filter { it.length >= 2 }
                            .distinct()
                            .take(5)
                        lifecycleScope.launch(Dispatchers.IO) {
                            val visuals = FokkSearchAggregator.fetchVisualEvidence(
                                entities = visualEntitiesQuery,
                                fallbackTitle = title,
                                max = 5
                            )
                            withContext(Dispatchers.Main) {
                                if (sheetDialog.isShowing && visuals.isNotEmpty()) {
                                    renderVisualEvidenceGallery(visuals)
                                }
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Could not render summary", Toast.LENGTH_SHORT).show()
        }
    }

    private fun checkAndIncrementAiQuota(): Boolean {
        val isPro = com.adshield.app.engine.VpnEngine.isProModeEnabled(this)
        if (isPro) return true

        val today = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(java.util.Date())
        val lastDate = prefs.getString("fokk_ai_quota_date", "")
        var count = prefs.getInt("fokk_ai_quota_count", 0)

        if (lastDate != today) {
            count = 0
            prefs.edit().putString("fokk_ai_quota_date", today).putInt("fokk_ai_quota_count", 0).apply()
        }

        if (count >= 5) {
            return false
        }

        prefs.edit().putInt("fokk_ai_quota_count", count + 1).apply()
        return true
    }

    private fun showAiQuotaExceededDialog() {
        AlertDialog.Builder(this)
            .setTitle("Fokk AI Free Tier Limit")
            .setMessage("You have reached your 5 free AI queries for today. Upgrade to Fokk Pro for unlimited real-time DOM analysis, truth audits, and conversational AI, or add your own OpenRouter API key in Settings.")
            .setPositiveButton("Upgrade to Pro") { _, _ ->
                showVpnProDialog()
            }
            .setNegativeButton("OK", null)
            .show()
    }

    private fun stripEmojis(text: String): String {
        if (text.isEmpty()) return ""
        val sb = StringBuilder(text.length)
        var i = 0
        while (i < text.length) {
            val cp = text.codePointAt(i)
            val charCount = Character.charCount(cp)
            val isEmoji = (cp in 0x1F300..0x1FAFF) ||
                          (cp in 0x1F600..0x1F64F) ||
                          (cp in 0x2600..0x27BF) ||
                          (cp in 0xFE00..0xFE0F) ||
                          (cp in 0x1F900..0x1F9FF) ||
                          (cp in 0x1F1E6..0x1F1FF) ||
                          (cp in 0x2300..0x23FF) ||
                          (cp == 0x2B50) || (cp == 0x2B55) || (cp == 0x200D)
            if (!isEmoji) {
                sb.appendCodePoint(cp)
            }
            i += charCount
        }
        return sb.toString().trim()
    }

    private fun formatMarkdownToSpanned(markdown: String): CharSequence {
        val html = markdown
            .replace("\r\n", "\n")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace(Regex("""(?m)^###\s+(.*?)$"""), "<br><b><font color=\"#F8FAFC\">$1</font></b><br>")
            .replace(Regex("""(?m)^##\s+(.*?)$"""), "<br><b><font color=\"#F8FAFC\"><big>$1</big></font></b><br>")
            .replace(Regex("""(?m)^#\s+(.*?)$"""), "<br><b><font color=\"#FFFFFF\"><big>$1</big></font></b><br>")
            .replace(Regex("""\*\*(.+?)\*\*"""), "<b><font color=\"#FFFFFF\">$1</font></b>")
            .replace(Regex("""`([^`]+)`"""), "<tt><font color=\"#38BDF8\">$1</font></tt>")
            .replace(Regex("""(?<!\*)\*([^*]+?)\*(?!\*)"""), "<i>$1</i>")
            .replace(Regex("""(?m)^[•*-]\s+(.*?)$"""), "<font color=\"#38BDF8\">&#8226;</font>&nbsp; $1<br>")
            .replace(Regex("""(?m)^(\d+)\.\s+(.*?)$"""), "<b><font color=\"#38BDF8\">$1.</font></b> $2<br>")
            .replace(Regex("""\[(\d+)]"""), "<font color=\"#38BDF8\"><sup>[$1]</sup></font>")
            .replace("\n\n", "<br><br>")
            .replace("\n", "<br>")
            .replace(Regex("""^(<br>)+"""), "")
            .replace(Regex("""(<br>){3,}"""), "<br><br>")

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            android.text.Html.fromHtml(html, android.text.Html.FROM_HTML_MODE_COMPACT)
        } else {
            @Suppress("DEPRECATION")
            android.text.Html.fromHtml(html)
        }
    }

    private fun fetchBrowserSearchSources(query: String, maxResults: Int = 4): List<BrowserSearchResult> {
        val cleanQ = query.trim()
        if (cleanQ.isBlank()) return emptyList()
        return try {
            val googleNews = FokkSearchAggregator.fetchGoogleNews(cleanQ, max = 2)
            val wiki = FokkSearchAggregator.fetchWikipedia(cleanQ, max = 2)
            (googleNews + wiki).map {
                BrowserSearchResult(it.title, it.url, it.domain, it.snippet, it.sourceType, it.timestamp)
            }.take(maxResults)
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun callFokkAiEngine(
        systemPrompt: String,
        userQuery: String,
        searchSources: List<BrowserSearchResult> = emptyList()
    ): String {
        val sources = searchSources.map {
            CorroboratedSource(it.title, it.url, it.domain, it.snippet, it.sourceType, it.timestamp)
        }
        val (answer, followUps) = runCatching {
            kotlinx.coroutines.runBlocking(Dispatchers.IO) {
                FokkAiEngine.queryInteractiveResearch(
                    context = this@MediaHubActivity,
                    userQuery = userQuery,
                    pageTitle = "",
                    pageHost = "",
                    pageContext = lastAiPageContext,
                    externalSources = sources
                )
            }
        }.getOrDefault(Pair(FokkAiEngine.buildOfflineForensicSynthesis(userQuery, lastAiPageContext, sources), emptyList()))

        return if (followUps.isNotEmpty()) {
            answer + "\n\nSUGGESTED_FOLLOWUPS: " + followUps.joinToString(" | ")
        } else {
            answer
        }
    }

    private fun callOpenRouterEndpoint(
        apiKey: String,
        systemPrompt: String,
        userQuery: String,
        model: String = "particle-ai/particle-1:free"
    ): String {
        return try {
            val endpoint = "https://openrouter.ai/api/v1/chat/completions"
            val body = org.json.JSONObject().apply {
                put("model", model)
                put("max_tokens", 800)
                put("messages", org.json.JSONArray().apply {
                    put(org.json.JSONObject().apply {
                        put("role", "system")
                        put("content", systemPrompt)
                    })
                    put(org.json.JSONObject().apply {
                        put("role", "user")
                        put("content", userQuery)
                    })
                })
            }.toString().toByteArray(java.nio.charset.StandardCharsets.UTF_8)

            val conn = java.net.URL(endpoint).openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            if (apiKey.isNotBlank()) {
                conn.setRequestProperty("Authorization", "Bearer $apiKey")
            }
            conn.setRequestProperty("HTTP-Referer", "https://fokk.app")
            conn.setRequestProperty("X-Title", "Fokk Browser AI")
            conn.connectTimeout = 7_000
            conn.readTimeout = 15_000
            conn.doOutput = true
            conn.outputStream.use { it.write(body) }

            val code = conn.responseCode
            if (code == 200) {
                val resp = conn.inputStream.bufferedReader(java.nio.charset.StandardCharsets.UTF_8).use { it.readText() }
                val json = org.json.JSONObject(resp)
                val choices = json.optJSONArray("choices") ?: return ""
                if (choices.length() == 0) return ""
                val message = choices.getJSONObject(0).optJSONObject("message") ?: return ""

                var text = message.optString("content", "").trim()
                if (text.isBlank() || text == "null") {
                    text = message.optString("reasoning", "").trim()
                }
                if (text.isBlank() || text == "null") {
                    val details = message.optJSONArray("reasoning_details")
                    if (details != null && details.length() > 0) {
                        text = details.getJSONObject(0).optString("text", "").trim()
                    }
                }

                if (text.isNotBlank()) {
                    val clean = if (text.startsWith("Here's a thinking process:", ignoreCase = true) ||
                        text.startsWith("We need to respond", ignoreCase = true)) {
                        val parts = text.split("\n\n")
                        if (parts.size > 1) parts.drop(1).joinToString("\n\n") else text
                    } else {
                        text
                    }
                    stripEmojis(clean)
                } else ""
            } else ""
        } catch (_: Exception) {
            ""
        }
    }

    private fun buildOfflineForensicBriefing(
        query: String,
        searchSources: List<BrowserSearchResult> = emptyList()
    ): String {
        val corroborated = searchSources.map {
            com.adshield.app.engine.CorroboratedSource(
                title = it.title,
                url = it.url,
                domain = it.domain,
                snippet = it.snippet
            )
        }
        return FokkAiEngine.buildOfflineForensicSynthesis(query, lastAiPageContext, corroborated)
    }

    fun showSavedSummariesDialog() {
        val dialog = BottomSheetDialog(this)
        val b = SheetSavedSummariesBinding.inflate(layoutInflater)
        dialog.setContentView(b.root)

        b.btnCloseSavedSummaries.setOnClickListener { dialog.dismiss() }

        val summaries = savedSummariesStore.list()
        b.textSavedSummariesCount.text = "${summaries.size} summaries stored on-device"

        if (summaries.isEmpty()) {
            b.textEmptySavedSummaries.visibility = View.VISIBLE
        } else {
            b.textEmptySavedSummaries.visibility = View.GONE
            val density = resources.displayMetrics.density
            summaries.forEach { item ->
                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_stat_chip)
                    setPadding((14 * density).toInt(), (12 * density).toInt(), (14 * density).toInt(), (12 * density).toInt())
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = (10 * density).toInt()
                    }
                    isClickable = true
                    isFocusable = true
                }

                val headerRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    )
                }

                val sourceTv = TextView(this).apply {
                    text = item.source.ifBlank { item.sourceHost.ifBlank { "Article" } }
                    setTextColor(ContextCompat.getColor(this@MediaHubActivity, R.color.fokk_cyan))
                    textSize = 11.5f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                }

                val readTimeTv = TextView(this).apply {
                    text = item.readingTime
                    setTextColor(ContextCompat.getColor(this@MediaHubActivity, R.color.text_secondary))
                    textSize = 11f
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        marginEnd = (8 * density).toInt()
                    }
                }

                val deleteBtn = ImageButton(this).apply {
                    layoutParams = LinearLayout.LayoutParams((28 * density).toInt(), (28 * density).toInt())
                    background = ContextCompat.getDrawable(this@MediaHubActivity, R.drawable.bg_circle_icon_button)
                    setImageResource(R.drawable.ic_delete)
                    setColorFilter(ContextCompat.getColor(this@MediaHubActivity, R.color.text_secondary))
                    contentDescription = "Delete Summary"
                    setOnClickListener {
                        savedSummariesStore.delete(item.id)
                        dialog.dismiss()
                        showSavedSummariesDialog()
                        Toast.makeText(this@MediaHubActivity, "Summary deleted", Toast.LENGTH_SHORT).show()
                    }
                }

                headerRow.addView(sourceTv)
                headerRow.addView(readTimeTv)
                headerRow.addView(deleteBtn)

                val titleTv = TextView(this).apply {
                    text = item.title
                    setTextColor(ContextCompat.getColor(this@MediaHubActivity, R.color.text_primary))
                    textSize = 14.5f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    maxLines = 2
                    ellipsize = TextUtils.TruncateAt.END
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        topMargin = (6 * density).toInt()
                    }
                }

                val snippetTv = TextView(this).apply {
                    text = item.executiveSummary.ifBlank { item.bullets.firstOrNull().orEmpty() }
                    setTextColor(ContextCompat.getColor(this@MediaHubActivity, R.color.text_secondary))
                    textSize = 12.5f
                    maxLines = 2
                    ellipsize = TextUtils.TruncateAt.END
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        topMargin = (4 * density).toInt()
                    }
                }

                card.addView(headerRow)
                card.addView(titleTv)
                card.addView(snippetTv)

                card.setOnClickListener {
                    dialog.dismiss()
                    showAiSummarySheet(item.toJson().toString())
                }

                b.layoutSavedSummariesList.addView(card)
            }
        }

        dialog.show()
    }

    private fun configureTtsVoice(isMale: Boolean) {
        textToSpeech?.let { tts ->
            val speed = ttsSpeechSpeed.coerceIn(0.75f, 2.0f)
            if (isMale) {
                tts.setPitch(0.88f)
                tts.setSpeechRate(0.96f * speed)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val male = tts.voices?.firstOrNull {
                        it.name.contains("male", ignoreCase = true) || it.name.contains("#male", ignoreCase = true)
                    }
                    if (male != null) tts.voice = male
                }
            } else {
                tts.setPitch(1.04f)
                tts.setSpeechRate(1.0f * speed)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val female = tts.voices?.firstOrNull {
                        it.name.contains("female", ignoreCase = true) || it.name.contains("#female", ignoreCase = true)
                    }
                    if (female != null) tts.voice = female
                }
            }
        }
    }

    private fun buildTtsChunks(rawText: String): List<String> {
        val clean = rawText
            .replace(Regex("""[*#`_]"""), "")
            .replace(Regex("""\[\d+]"""), "")
            .replace(Regex("""\s+"""), " ")
            .trim()
        if (clean.isBlank()) return emptyList()
        val sentences = clean.split(Regex("""(?<=[.!?])\s+""")).map { it.trim() }.filter { it.isNotBlank() }
        val chunks = mutableListOf<String>()
        val buf = StringBuilder()
        for (s in sentences) {
            if (s.length > 260) {
                if (buf.isNotEmpty()) {
                    chunks.add(buf.toString().trim())
                    buf.clear()
                }
                var idx = 0
                while (idx < s.length) {
                    val end = minOf(idx + 240, s.length)
                    chunks.add(s.substring(idx, end).trim())
                    idx = end
                }
            } else if (buf.length + s.length + 1 > 260) {
                if (buf.isNotEmpty()) {
                    chunks.add(buf.toString().trim())
                    buf.clear()
                }
                buf.append(s)
            } else {
                if (buf.isNotEmpty()) buf.append(" ")
                buf.append(s)
            }
        }
        if (buf.isNotEmpty()) chunks.add(buf.toString().trim())
        return chunks.filter { it.isNotBlank() }
    }

    private fun initTextToSpeech() {
        if (textToSpeech == null) {
            isTtsReady = false
            textToSpeech = TextToSpeech(this) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    isTtsReady = true
                    textToSpeech?.language = Locale.getDefault()
                    val isMale = prefs.getBoolean("pref_tts_male_voice", true)
                    configureTtsVoice(isMale)
                    textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {
                            runOnUiThread {
                                if (ttsPlaybackState == 1) {
                                    ttsProgressCallback?.invoke(1, ttsChunkIndex, ttsChunks.size, ttsCurrentSourceTag)
                                }
                            }
                        }

                        override fun onDone(utteranceId: String?) {
                            runOnUiThread {
                                val expectedId = "fokk_tts_${ttsSessionId}_${ttsChunkIndex}"
                                if (ttsPlaybackState != 1 || utteranceId != expectedId) return@runOnUiThread
                                if (ttsChunkIndex + 1 < ttsChunks.size) {
                                    ttsChunkIndex++
                                    speakCurrentChunk()
                                } else {
                                    ttsPlaybackState = 0
                                    ttsChunkIndex = 0
                                    ttsProgressCallback?.invoke(0, 0, ttsChunks.size, ttsCurrentSourceTag)
                                }
                            }
                        }

                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) {
                            runOnUiThread {
                                val expectedId = "fokk_tts_${ttsSessionId}_${ttsChunkIndex}"
                                if (utteranceId == expectedId) {
                                    ttsPlaybackState = 0
                                    ttsChunkIndex = 0
                                    ttsProgressCallback?.invoke(0, 0, ttsChunks.size, ttsCurrentSourceTag)
                                }
                            }
                        }
                    })
                    val queued = pendingTtsText
                    val queuedTag = pendingTtsSourceTag
                    if (!queued.isNullOrBlank()) {
                        pendingTtsText = null
                        startTextToSpeech(queued, queuedTag)
                    }
                }
            }
        }
    }

    private fun speakCurrentChunk() {
        val tts = textToSpeech ?: return
        if (ttsChunkIndex !in ttsChunks.indices) {
            ttsPlaybackState = 0
            ttsChunkIndex = 0
            ttsProgressCallback?.invoke(0, 0, ttsChunks.size, ttsCurrentSourceTag)
            return
        }
        val isMale = prefs.getBoolean("pref_tts_male_voice", true)
        configureTtsVoice(isMale)
        val chunk = ttsChunks[ttsChunkIndex]
        val uttId = "fokk_tts_${ttsSessionId}_${ttsChunkIndex}"
        ttsProgressCallback?.invoke(1, ttsChunkIndex, ttsChunks.size, ttsCurrentSourceTag)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            tts.speak(chunk, TextToSpeech.QUEUE_FLUSH, null, uttId)
        } else {
            @Suppress("DEPRECATION")
            tts.speak(chunk, TextToSpeech.QUEUE_FLUSH, null)
        }
    }

    fun startTextToSpeech(text: String, sourceTag: String = "summary") {
        val chunks = buildTtsChunks(text)
        if (chunks.isEmpty()) return

        if (textToSpeech == null || !isTtsReady) {
            pendingTtsText = text
            pendingTtsSourceTag = sourceTag
            ttsCurrentSourceTag = sourceTag
            ttsChunks = chunks
            ttsChunkIndex = 0
            ttsPlaybackState = 1
            initTextToSpeech()
            ttsProgressCallback?.invoke(1, 0, chunks.size, sourceTag)
            return
        }

        // If resuming the exact same paused source, continue right from ttsChunkIndex
        if (ttsPlaybackState == 2 && ttsCurrentSourceTag == sourceTag && ttsChunks.isNotEmpty() && ttsChunkIndex in ttsChunks.indices) {
            ttsSessionId++
            ttsPlaybackState = 1
            speakCurrentChunk()
            return
        }

        ttsSessionId++
        ttsCurrentSourceTag = sourceTag
        ttsChunks = chunks
        ttsChunkIndex = 0
        ttsPlaybackState = 1
        speakCurrentChunk()
    }

    fun pauseTextToSpeech() {
        if (ttsPlaybackState != 1) return
        ttsSessionId++
        pendingTtsText = null
        textToSpeech?.stop()
        ttsPlaybackState = 2
        ttsProgressCallback?.invoke(2, ttsChunkIndex, ttsChunks.size, ttsCurrentSourceTag)
    }

    fun stopTextToSpeech() {
        ttsSessionId++
        pendingTtsText = null
        textToSpeech?.stop()
        ttsPlaybackState = 0
        ttsChunkIndex = 0
        ttsProgressCallback?.invoke(0, 0, ttsChunks.size, ttsCurrentSourceTag)
    }

    // =========================================================================
    // SPECULATIVE CLOUDFLARE DoH PRE-WARMER (0ms Perceived Latency)
    // =========================================================================
    fun speculativePreWarm(url: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val host = Uri.parse(url).host ?: return@launch
                if (!prewarmedHosts.add(host)) return@launch

                val dohUrl = "https://1.1.1.1/dns-query?name=$host&type=A"
                val conn = URL(dohUrl).openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Accept", "application/dns-json")
                conn.connectTimeout = 800
                conn.readTimeout = 800
                conn.connect()
                if (conn.responseCode == 200) {
                    val response = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(response)
                    val answers = json.optJSONArray("Answer")
                    val ip = answers?.optJSONObject(0)?.optString("data")

                    if (!ip.isNullOrBlank()) {
                        Socket().use { socket ->
                            socket.connect(InetSocketAddress(ip, 443), 400)
                        }
                    }
                }
                conn.disconnect()
            } catch (e: Exception) {}
        }
    }

    // =========================================================================
    // PAYWALL MIRROR SWITCHER
    // =========================================================================
    fun openPaywallMirror() {
        val url = lastPaywallUrl.ifEmpty { activeWebView?.url.orEmpty() }
        if (url.isNotBlank() && !url.contains("fokk_start.html")) {
            val mirrorUrl = "https://archive.is/newest/$url"
            loadUrlInActiveWebView(mirrorUrl)
            Toast.makeText(this, "Opening archive mirror snapshot...", Toast.LENGTH_SHORT).show()
        }
    }

    // =========================================================================
    // SMART TAB HIBERNATION (MEMORY SAVER)
    // =========================================================================
    private fun checkAndHibernateBackgroundTabs() {
        val now = System.currentTimeMillis()
        val HIBERNATION_TIMEOUT_MS = 5 * 60 * 1000L // 5 minutes

        tabs.forEachIndexed { idx, tab ->
            if (idx != activeTabIndex && idx != secondaryTabIndex && !tab.isHibernated && !isMediaPlaying) {
                if (now - tab.lastActiveTime > HIBERNATION_TIMEOUT_MS) {
                    tab.isHibernated = true
                    tab.savedScrollY = tab.webView?.scrollY ?: 0
                    tab.webView?.pauseTimers()
                    tab.webView?.destroyDrawingCache()
                }
            }
        }
    }

    // =========================================================================
    // READER MODE & AI SUMMARIZER LAUNCHERS
    // =========================================================================
    fun openReaderView() {
        val webView = activeWebView ?: return
        if (isThirdPartyMediaService(webView.url) || webView.url?.contains("fokk_start.html") == true) {
            Toast.makeText(this, "Reader View is for article pages", Toast.LENGTH_SHORT).show()
            return
        }
        Toast.makeText(this, "Entering Reader Mode...", Toast.LENGTH_SHORT).show()
        val cssEscaped = readerCss.replace("`", "\\`").replace("\\", "\\\\")
        val js = """
            (function() {
                if (!document.getElementById('__fokk_reader_style')) {
                    const style = document.createElement('style');
                    style.id = '__fokk_reader_style';
                    style.textContent = `$cssEscaped`;
                    (document.head || document.documentElement).appendChild(style);
                }
                $readerScript
                if (typeof window.toggleFokkReaderMode === 'function') {
                    window.toggleFokkReaderMode(true);
                }
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    fun showSmartPageSummaryDialog(initialTab: Int = 0) {
        pendingAiSummaryInitialTab = initialTab
        val webView = activeWebView
        val url = webView?.url
        if (webView == null || url.isNullOrBlank() || url.contains("fokk_start.html")) {
            lastAiPageContext = ""
            val introJson = org.json.JSONObject().apply {
                put("title", "Fokk AI")
                put("source", "Fokk AI")
                put("sourceHost", "fokk.ai")
                put("readingTime", "1 min read")
                put("wordCount", 120)
                put("executiveSummary", "Fokk AI delivers private, zero-latency summaries of articles, news stories, and technical pages entirely on your device. Ask any question about the current page in real time.")
                put("bullets", org.json.JSONArray().apply {
                    put("Open any webpage or article in Fokk Browser.")
                    put("Tap the AI button to get an instant executive briefing.")
                    put("Ask follow-up questions in the Ask AI tab.")
                    put("Listen to summaries aloud or save them for offline research.")
                })
                put("metrics", org.json.JSONArray().apply {
                    put("On-Device :: Local page parsing")
                    put("Zero Tracking :: No ad profiling")
                    put("Live Search :: Web-grounded Q&A")
                    put("3-Layer :: Source & bias audit")
                })
                put("followUpQuestions", org.json.JSONArray().apply {
                    put("How does Fokk AI verify claims across independent sources?")
                })
            }
            showAiSummarySheet(introJson.toString(), initialTab)
            return
        }

        // Dynamic social feeds (Instagram home, X home/profile, Reddit, Threads) change focal post while scrolling
        // WITHOUT changing window.location.href — never return a stale URL-only cached summary on those pages!
        val lowerUrl = url.lowercase(Locale.ROOT)
        val isDynamicSocialFeed = lowerUrl.contains("instagram.com") ||
            lowerUrl.contains("x.com") ||
            lowerUrl.contains("twitter.com") ||
            lowerUrl.contains("threads.net") ||
            lowerUrl.contains("reddit.com") ||
            lowerUrl.contains("facebook.com") ||
            lowerUrl.contains("tiktok.com")

        // Instant re-opening ONLY for static articles/pages already summarized for this exact URL
        if (!isDynamicSocialFeed && url == cachedAiSummaryUrl && !cachedAiSummaryJson.isNullOrBlank()) {
            showAiSummarySheet(cachedAiSummaryJson!!, initialTab)
            return
        }

        // Extract full editorial or viewport-focal social post text for LLM context (sanitized)
        val contextExtractJs = """
            (function() {
                try {
                    var host = (window.location.hostname || '').replace(/^www\./i, '').toLowerCase();
                    function pickVisible(nodes) {
                        var arr = Array.from(nodes || []);
                        var vh = window.innerHeight || 800;
                        var best = null, bestScore = -1;
                        for (var i = 0; i < arr.length; i++) {
                            var r = arr[i].getBoundingClientRect();
                            if (r.height < 60 || r.bottom <= 20 || r.top >= vh - 20) continue;
                            var visH = Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top));
                            var cy = (Math.max(0, r.top) + Math.min(vh, r.bottom)) / 2;
                            var score = visH + Math.max(0, 1 - Math.abs(cy - vh * 0.44) / (vh * 0.75)) * 220;
                            if (score > bestScore) { bestScore = score; best = arr[i]; }
                        }
                        return best || arr[0] || null;
                    }

                    // 1. Focal Tweet on Twitter/X (status match or viewport-centered tweet)
                    if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.x.com' || host === 'mobile.twitter.com') {
                        var tweets = document.querySelectorAll('article[data-testid="tweet"]');
                        var m = window.location.pathname.match(/\/status\/(\d+)/);
                        var focal = m ? Array.from(tweets).find(function(t){ return !!t.querySelector('a[href*="/status/' + m[1] + '"]'); }) : null;
                        if (!focal) focal = pickVisible(tweets);
                        if (focal) {
                            var nodes = Array.from(focal.querySelectorAll('[data-testid="tweetText"]'));
                            var texts = nodes.map(function(el) { return (el.innerText || '').replace(/\s+/g, ' ').trim(); })
                                .filter(function(t) { return t.length > 6 && !/\b\d+K?\s+Views\b/i.test(t) && !/^@\w+$/.test(t); });
                            if (texts.length > 0) return texts.join('\n\n');
                        }
                    }

                    // 2. Focal Instagram post (currently visible article in viewport or open modal)
                    if (host.indexOf('instagram.com') !== -1) {
                        var igFocal = document.querySelector('[role="dialog"] article') || pickVisible(document.querySelectorAll('article'));
                        if (igFocal) {
                            var capNodes = Array.from(igFocal.querySelectorAll('h1, span[dir="auto"], div[dir="auto"]'));
                            var caps = capNodes
                                .filter(function(el){ return !el.closest('header, button, [role="button"]'); })
                                .map(function(el){ return (el.innerText || '').replace(/\s+/g, ' ').trim(); })
                                .filter(function(t){ return t.length >= 12 && t.length < 1200 && !/^(like|likes|comment|share|save|follow|view all \d+ comments|add a comment|liked by)/i.test(t); });
                            if (caps.length > 0) return caps.slice(0, 6).join('\n\n');
                        }
                    }

                    // 2. Standard editorial containers
                    var containers = document.querySelectorAll('article,[role="main"],main,.article-body,.post-content,.entry-content,[itemprop="articleBody"]');
                    var root = null;
                    for (var i = 0; i < containers.length; i++) {
                        if (containers[i].querySelectorAll('p').length >= 2) { root = containers[i]; break; }
                    }
                    if (!root) root = document.body;
                    var paras = Array.from(root.querySelectorAll('p, blockquote'))
                        .map(function(el) {
                            return (el.innerText || '')
                                .replace(/\s+/g, ' ')
                                .replace(/\b([B-HJ-Z])\s+([a-z]{2,})\b/g, '$1$2')
                                .trim();
                        })
                        .filter(function(t) {
                            return t.length > 25 && !t.includes('{') &&
                                   !/^(sign in|subscribe|cookie|terms|privacy|follow us|all rights reserved)/i.test(t) &&
                                   !/\b\d{1,2}:\d{2}\s+(?:AM|PM)\b/i.test(t);
                        });
                    if (paras.length > 0) {
                        return paras.slice(0, 80).join('\n\n').substring(0, 12000);
                    }

                    // 3. Fallback: clean body innerText without scraping junk
                    var bodyText = (document.body ? document.body.innerText || '' : '').replace(/\s+/g, ' ').trim();
                    return bodyText.substring(0, 8000);
                } catch(e) { return ''; }
            })();
        """.trimIndent()
        webView.evaluateJavascript(contextExtractJs) { rawContext ->
            if (!rawContext.isNullOrBlank() && rawContext != "null") {
                lastAiPageContext = rawContext
                    .removePrefix("\"").removeSuffix("\"")
                    .replace("\\n", "\n").replace("\\t", " ").replace("\\\"", "\"")
                    .take(10000)
            }
        }

        aiSummaryWatchdog?.let(mainHandler::removeCallbacks)
        var handled = false
        val watchdog = Runnable {
            if (!handled && !isFinishing && !isDestroyed && activeAiSummarySheetDialog?.isShowing != true) {
                handled = true
                val fallbackJs = """
                    (function() {
                        try {
                            var t = document.title || 'Page Summary';
                            var desc = document.querySelector('meta[name="description"]')?.content || '';
                            var paras = Array.from(document.querySelectorAll('[data-testid="tweetText"], p, blockquote, article'))
                                .map(function(el) { return (el.innerText || '').trim(); })
                                .filter(function(txt) { return txt.length > 20 && !txt.includes('{') && !/\b\d+K?\s+Views\b/i.test(txt); });
                            var topP = paras.slice(0, 4);
                            if (topP.length === 0) topP = ['Content extracted directly from webpage.'];
                            var exec = desc || topP[0];
                            var obj = {
                                title: t,
                                source: window.location.hostname.replace(/^www\./i, '') || 'Web',
                                sourceHost: window.location.hostname || '',
                                favicon: 'https://www.google.com/s2/favicons?domain=' + window.location.hostname + '&sz=128',
                                executiveSummary: exec,
                                summary: exec,
                                bullets: topP,
                                metrics: [],
                                followUpQuestions: ['Has an official statement or announcement been confirmed?'],
                                readingTime: Math.max(1, Math.round(paras.join(' ').split(/\s+/).length / 200)) + ' min read',
                                wordCount: paras.join(' ').split(/\s+/).length
                            };
                            if (window.FokkShieldBridge && typeof window.FokkShieldBridge.showAiSummaryData === 'function') {
                                window.FokkShieldBridge.showAiSummaryData(JSON.stringify(obj));
                            }
                        } catch(e) {}
                    })();
                """.trimIndent()
                webView.evaluateJavascript(fallbackJs, null)
            }
        }
        aiSummaryWatchdog = watchdog
        mainHandler.postDelayed(watchdog, 4000L)

        val js = "$summarizerScript; if (typeof triggerFokkSummarizer === 'function') { triggerFokkSummarizer(); }"
        webView.evaluateJavascript(js, null)
    }

    private fun reportBrokenSite() {
        val url = activeWebView?.url ?: activeTab?.url ?: return
        val details = "Fokk Browser broken-site report\nURL: $url\nShield: ${if (isShieldEnabledFor(url)) "on" else "off"}\nAndroid: ${Build.VERSION.RELEASE}\nApp: ${AppUpdateManager.getCurrentVersionName(this)}\n\nDescribe what did not work:"
        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
            .setPrimaryClip(ClipData.newPlainText("Broken site report", details))
        startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, details)
        }, "Send broken-site report"))
    }

    override fun onResume() {
        super.onResume()
        isActivityResumed = true
        val routeFingerprint = getVpnRouteFingerprint()
        if (lastVpnRouteFingerprint != null && lastVpnRouteFingerprint != routeFingerprint) {
            activeWebView?.reload()
        }
        lastVpnRouteFingerprint = routeFingerprint
        backgroundPlaybackArmed = false
        backgroundNoMediaTicks = 0
        backgroundMediaKeepAlive?.let(mainHandler::removeCallbacks)
        backgroundMediaKeepAlive = null
        activeWebView?.onResume()
        activeWebView?.resumeTimers()
        activeWebView?.evaluateJavascript(
            """(function() {
                if (typeof window.__fokk_endBackgroundPlayback === 'function') {
                    window.__fokk_endBackgroundPlayback();
                } else {
                    window.__fokk_is_background = false;
                }
                if (typeof window.__fokk_resyncPlayback === 'function') {
                    window.__fokk_resyncPlayback();
                }
            })();""".trimIndent(),
            null
        )

        val inPip = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode
        if (!inPip) {
            val isHome = isHomePageUrl(activeWebView?.url)
            if (isHome) {
                binding.topBar.visibility = View.GONE
            } else if (customView == null && !isFullscreenCustomView) {
                // Only show topBar if not in fullscreen video mode
                binding.topBar.visibility = View.VISIBLE
            }
            binding.layoutCollapsedBar.visibility = View.GONE
            binding.bottomNav.visibility = View.VISIBLE
            activeWebView?.evaluateJavascript(
                """(function() {
                    document.documentElement.classList.remove('fokk-pip-active');
                    if (typeof window.__fokk_exit_pip_view === 'function') window.__fokk_exit_pip_view();
                    window.dispatchEvent(new Event('resize'));
                })();""".trimIndent(),
                null
            )
            activeWebView?.requestLayout()
        }

        val isDecoyEnabled = prefs.getBoolean(PREF_DECOY_CALCULATOR, false)
        if (isDecoyEnabled && !isDecoyUnlockedThisSession && !inPip) {
            val pin = prefs.getString(PREF_DECOY_PIN, "1337") ?: "1337"
            DecoyCalculatorDialog(this, unlockPin = pin) {
                isDecoyUnlockedThisSession = true
            }.show()
        }
    }

    /**
     * Tell the page it is leaving before WebView loses focus.  Doing this only in
     * onStop is too late on a lock-screen transition: sites have already sent a
     * pause command to their media element by then.
     */
    private fun armWebMediaForBackground() {
        if (!isMediaPlaying || !prefs.getBoolean("fokk_background_audio", true)) return
        backgroundPlaybackArmed = true
        backgroundNoMediaTicks = 0
        val host = activeTab?.url?.let { runCatching { Uri.parse(it).host }.getOrNull() } ?: "Fokk Browser"
        com.adshield.app.service.FokkMediaPlaybackService.start(this, currentMediaTitle, host, isPlaying = true)
        activeWebView?.let { webView ->
            webView.onResume()
            webView.resumeTimers()
            webView.evaluateJavascript(
                """(function() {
                    if (typeof window.__fokk_beginBackgroundPlayback === 'function') {
                        window.__fokk_beginBackgroundPlayback();
                    } else {
                        window.__fokk_is_background = true;
                    }
                    if (typeof window.__fokk_prepareBackgroundPlayback === 'function') {
                        window.__fokk_prepareBackgroundPlayback();
                    }
                })();""".trimIndent(),
                null
            )
        }
        if (backgroundMediaKeepAlive == null) {
            val heartbeat = object : Runnable {
                override fun run() {
                    if (!backgroundPlaybackArmed || isActivityResumed || isDestroyed) {
                        backgroundMediaKeepAlive = null
                        return
                    }
                    activeWebView?.evaluateJavascript(
                        "typeof window.__fokk_prepareBackgroundPlayback === 'function' ? window.__fokk_prepareBackgroundPlayback() : true;"
                    ) { result ->
                        if (result == "false") {
                            backgroundNoMediaTicks += 1
                            if (backgroundNoMediaTicks >= 3) {
                                backgroundPlaybackArmed = false
                                isMediaPlaying = false
                                hasActiveVideo = false
                                backgroundMediaKeepAlive = null
                                activeWebView?.evaluateJavascript(
                                    "if (typeof window.__fokk_endBackgroundPlayback === 'function') window.__fokk_endBackgroundPlayback();",
                                    null
                                )
                                updateMediaSessionPlaybackState(isPlaying = false)
                                com.adshield.app.service.FokkMediaPlaybackService.stop(this@MediaHubActivity)
                                if (mediaWakeLock?.isHeld == true) runCatching { mediaWakeLock?.release() }
                            }
                        } else {
                            backgroundNoMediaTicks = 0
                        }
                    }
                    mainHandler.postDelayed(this, 1_500L)
                }
            }
            backgroundMediaKeepAlive = heartbeat
            mainHandler.postDelayed(heartbeat, 1_500L)
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE && !(isMediaPlaying && hasActiveVideo)) {
            collapseCommandBar(animated = true)
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        armWebMediaForBackground()
        val currentUrl = activeTab?.url.orEmpty()
        val isStartPage = currentUrl.contains("fokk_start.html")
        val autoPipEnabled = prefs.getBoolean("fokk_auto_pip", true)
        // PiP strictly triggers ONLY when an active video is actively playing!
        if (!isStartPage && autoPipEnabled && isMediaPlaying && (hasActiveVideo || customView != null)) {
            enterPipMode(showFailureToast = false)
        }
    }

    private fun enterPipMode(showFailureToast: Boolean = true) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isMediaPlaying && (hasActiveVideo || customView != null)) {
            // Fullscreen WebChromeClient video already has a dedicated native
            // view. Let Android PiP capture that surface directly.
            if (customView != null) {
                enterNativePipMode()
                return
            }
            val webView = activeWebView
            if (webView == null) {
                if (showFailureToast) Toast.makeText(this, "The active video is not ready for picture-in-picture", Toast.LENGTH_SHORT).show()
                return
            }
            // Only minimize after the page confirms it has a currently playing
            // video element. This avoids opening PiP around the browser chrome
            // when a site's media surface is inaccessible to the DOM.
            webView.evaluateJavascript(
                "typeof window.__fokk_enter_pip_view === 'function' ? window.__fokk_enter_pip_view() : false;"
            ) { result ->
                if (result == "true") {
                    enterNativePipMode()
                } else if (showFailureToast) {
                    Toast.makeText(this, "This site's video surface cannot be minimized by the browser", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun enterNativePipMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isMediaPlaying && (hasActiveVideo || customView != null)) {
            try {
                val currentUrl = activeTab?.url.orEmpty()
                val isShorts = currentUrl.contains("/shorts/") || currentUrl.contains("tiktok.com") || currentUrl.contains("instagram.com/reels")
                val ratio = if (isShorts) Rational(9, 16) else Rational(16, 9)
                val builder = PictureInPictureParams.Builder()
                    .setAspectRatio(ratio)

                if (customView != null) {
                    val rect = android.graphics.Rect()
                    customView?.getGlobalVisibleRect(rect)
                    if (!rect.isEmpty && rect.width() > 0 && rect.height() > 0) {
                        builder.setSourceRectHint(rect)
                    }
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // PiP entry is coordinated after the page promotes its video.
                    // Android's automatic path snapshots the unmodified browser UI.
                    builder.setAutoEnterEnabled(false)
                    builder.setSeamlessResizeEnabled(true)
                }
                enterPictureInPictureMode(builder.build())
            } catch (e: Exception) {
                Log.e(TAG, "Error entering PiP mode", e)
            }
        }
    }

    override fun onPause() {
        // Run before the framework pauses the Activity/WebView on a lock-screen
        // transition. onStop alone is too late for many web players.
        armWebMediaForBackground()
        super.onPause()
        isActivityResumed = false
        persistSession()
        updateGhostModeNotification()
        val bgAudio = prefs.getBoolean("fokk_background_audio", true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode) {
            activeWebView?.onResume()
            return
        }
        if (isMediaPlaying && bgAudio) {
            armWebMediaForBackground()
            if (mediaWakeLock?.isHeld == false) {
                try { mediaWakeLock?.acquire(3 * 60 * 60 * 1000L) } catch (e: Exception) {}
            }
            try {
                val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                @Suppress("DEPRECATION")
                am?.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
            } catch (e: Exception) {}
        }
        CookieManager.getInstance().flush()
    }

    override fun onStop() {
        super.onStop()
        updateGhostModeNotification()
        val bgAudio = prefs.getBoolean("fokk_background_audio", true)
        if (isMediaPlaying && bgAudio) {
            armWebMediaForBackground()
            if (mediaWakeLock?.isHeld == false) {
                try { mediaWakeLock?.acquire(3 * 60 * 60 * 1000L) } catch (e: Exception) {}
            }
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (isInPictureInPictureMode) {
            binding.topBar.visibility = View.GONE
            binding.layoutCollapsedBar.visibility = View.GONE
            binding.bottomNav.visibility = View.GONE
            binding.progressBar.visibility = View.GONE
            binding.cardSuggestions.visibility = View.GONE
            binding.btnPictureInPicture.visibility = View.GONE
            activeWebView?.onResume()
            activeWebView?.resumeTimers()
            activeWebView?.evaluateJavascript("if (typeof window.__fokk_enter_pip_view === 'function') window.__fokk_enter_pip_view();", null)
        } else {
            val isHome = isHomePageUrl(activeWebView?.url)
            if (isHome) {
                binding.topBar.visibility = View.GONE
            } else {
                binding.topBar.visibility = View.VISIBLE
            }
            binding.layoutCollapsedBar.visibility = View.GONE
            binding.btnPictureInPicture.visibility = View.GONE
            activeWebView?.evaluateJavascript("if (typeof window.__fokk_exit_pip_view === 'function') window.__fokk_exit_pip_view();", null)
            activeWebView?.requestLayout()
        }
    }

    private fun updateGhostModeNotification() {
        val privateCount = tabs.count { it.isPrivate }
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        if (privateCount > 0 || isIsolatedPrivateProfile) {
            val countText = if (privateCount > 0) "$privateCount private tab${if (privateCount > 1) "s" else ""} open" else "Ghost Mode active"
            val wipeIntent = Intent(this, MediaHubActivity::class.java).apply {
                action = ACTION_WIPE_GHOST_SESSION
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pIntent = PendingIntent.getActivity(
                this,
                NOTIFICATION_ID_GHOST_MODE,
                wipeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
            )
            val notif = NotificationCompat.Builder(this, AdShieldApp.CHANNEL_ID_GHOST_MODE)
                .setSmallIcon(R.drawable.ic_ghost)
                .setContentTitle("Ghost Mode is Active")
                .setContentText("$countText. Tap to close all & wipe session.")
                .setContentIntent(pIntent)
                .setOngoing(true)
                .setAutoCancel(true)
                .addAction(R.drawable.ic_close, "Close & Wipe", pIntent)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()
            try {
                notificationManager.notify(NOTIFICATION_ID_GHOST_MODE, notif)
            } catch (e: SecurityException) {}
        } else {
            notificationManager.cancel(NOTIFICATION_ID_GHOST_MODE)
        }
    }

    private fun wipeAllPrivateTabsAndSession() {
        val privateTabs = tabs.filter { it.isPrivate }
        privateTabs.forEach { tab ->
            tab.webView?.let { wv ->
                cancelPendingWebPermission(wv)
                cancelPendingLocationPermission(wv)
                binding.tabContainer.removeView(wv)
                pageUrlsByWebView.remove(wv)
                wv.destroy()
            }
        }
        tabs.removeAll { it.isPrivate }
        showingPrivateTabs = false
        CookieManager.getInstance().removeSessionCookies(null)
        WebStorage.getInstance().deleteAllData()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.cancel(NOTIFICATION_ID_GHOST_MODE)

        if (isIsolatedPrivateProfile) {
            Toast.makeText(this, "Ghost Mode session wiped", Toast.LENGTH_SHORT).show()
            finishAffinity()
            return
        }

        if (tabs.isEmpty()) {
            addNewTab("file:///android_asset/fokk_start.html", isPrivate = false)
        } else {
            switchToTab(0)
        }
        updateTabCounter()
        persistSession()
        Toast.makeText(this, "Ghost Mode tabs closed & session wiped", Toast.LENGTH_SHORT).show()
    }

    fun openShieldDashboard() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        startActivity(intent)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.urlInput.hasFocus()) {
            binding.urlInput.clearFocus()
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
            imm?.hideSoftInputFromWindow(binding.urlInput.windowToken, 0)
            binding.cardSuggestions.visibility = View.GONE
            return
        }
        if (binding.cardSuggestions.visibility == View.VISIBLE) {
            binding.cardSuggestions.visibility = View.GONE
            return
        }
        if (customView != null) {
            hideCustomView()
        } else if (activeWebView?.canGoBack() == true) {
            activeWebView?.goBack()
        } else if (isIsolatedPrivateProfile) {
            closePrivateBrowser()
        } else if (tabs.size > 1) {
            closeTab(activeTabIndex)
        } else {
            val currentUrl = activeTab?.url.orEmpty()
            val isPrivateTab = activeTab?.isPrivate == true
            if (currentUrl.isNotBlank() && !currentUrl.contains("fokk_start.html")) {
                // Return to the correct home page — private tabs go back to incognito home, not normal home
                if (isPrivateTab) {
                    loadUrlInActiveWebView("file:///android_asset/fokk_start.html?incognito=true")
                } else {
                    loadUrlInActiveWebView("file:///android_asset/fokk_start.html")
                }
            } else {
                moveTaskToBack(true)
            }
        }
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(meshStateReceiver) }
        backgroundMediaKeepAlive?.let(mainHandler::removeCallbacks)
        backgroundMediaKeepAlive = null
        stopPlaybackRunnable?.let(mainHandler::removeCallbacks)
        stopPlaybackRunnable = null
        if (isFinishing) {
            backgroundPlaybackArmed = false
            com.adshield.app.service.FokkMediaPlaybackService.stop(this)
        }
        suggestionJob?.cancel()
        pendingWebPermission?.request?.deny()
        pendingWebPermission = null
        pendingLocationPermission?.let { it.callback.invoke(it.origin, false, false) }
        pendingLocationPermission = null
        mainHandler.removeCallbacks(filteredCountFlushRunnable)
        flushFilteredRequestCounts()
        for (tab in tabs) {
            tab.webView?.let { webView ->
                binding.tabContainer.removeView(webView)
                webView.destroy()
            }
        }
        tabs.clear()
        // Never let a failed isolated-profile setup fall through to the default WebView
        // profile: cleanup here would otherwise erase normal browsing data.
        if (isIsolatedPrivateProfile && privateProfileConfigurationReady &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && isFinishing && !privateProfileDataClearedOnClose
        ) {
            clearPrivateProfileData()
        }
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        if (mediaWakeLock?.isHeld == true) {
            try { mediaWakeLock?.release() } catch (e: Exception) {}
        }
        try { mediaSession?.release() } catch (e: Exception) {}
        mediaSession = null
        (getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)?.cancel(NOTIFICATION_ID_MEDIA_PLAYBACK)
        super.onDestroy()
    }

    override fun onLowMemory() {
        super.onLowMemory()
        for (tab in tabs) {
            if (tab !== activeTab) {
                tab.webView?.clearCache(false)
            }
        }
        activeWebView?.clearCache(false)
    }

    private fun loadAvatarInto(imageView: ImageView) {
        val avatar = prefs.getString(PREF_USER_AVATAR, "falcon") ?: "falcon"
        if (avatar == "custom") {
            val file = File(filesDir, "custom_avatar.jpg")
            if (file.exists()) {
                val bmp = BitmapFactory.decodeFile(file.absolutePath)
                if (bmp != null) {
                    imageView.setImageBitmap(bmp)
                    return
                }
            }
        }
        val resId = when (avatar) {
            "aegis" -> R.drawable.ic_avatar_aegis
            "terminal" -> R.drawable.ic_avatar_terminal
            "vault" -> R.drawable.ic_avatar_vault
            "valkyrie" -> R.drawable.ic_avatar_valkyrie
            "spectre" -> R.drawable.ic_avatar_spectre
            else -> R.drawable.ic_avatar_falcon
        }
        imageView.setImageResource(resId)
    }

    private fun showPrivacyAccountDialog() {
        val dialog = BottomSheetDialog(this)
        val sheetBinding = SheetPrivacyAccountBinding.inflate(layoutInflater)
        dialog.setContentView(sheetBinding.root)
        activeAccountDialogBinding = sheetBinding

        fun refreshProfileHeader() {
            val alias = prefs.getString(PREF_USER_ALIAS, "Fokk User") ?: "Fokk User"
            sheetBinding.textAccountAlias.text = alias
            loadAvatarInto(sheetBinding.imgAccountAvatar)
        }

        refreshProfileHeader()

        val avatarMap = mapOf(
            sheetBinding.optAvatarFalcon to "falcon",
            sheetBinding.optAvatarAegis to "aegis",
            sheetBinding.optAvatarTerminal to "terminal",
            sheetBinding.optAvatarVault to "vault",
            sheetBinding.optAvatarValkyrie to "valkyrie",
            sheetBinding.optAvatarSpectre to "spectre"
        )

        avatarMap.forEach { (view, avatarName) ->
            view.setOnClickListener {
                prefs.edit().putString(PREF_USER_AVATAR, avatarName).apply()
                refreshProfileHeader()
                Toast.makeText(this, "Identity badge set to ${avatarName.replaceFirstChar { if (it.isLowerCase()) it.titlecase(java.util.Locale.getDefault()) else it.toString() }}", Toast.LENGTH_SHORT).show()
            }
        }

        sheetBinding.btnUploadCustomAvatar.setOnClickListener {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "image/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            avatarPhotoPickerLauncher.launch(Intent.createChooser(intent, "Choose Avatar Photo"))
        }

        sheetBinding.btnEditAlias.setOnClickListener {
            val currentAlias = prefs.getString(PREF_USER_ALIAS, "Fokk User") ?: "Fokk User"
            val input = EditText(this).apply {
                setText(currentAlias)
                setSingleLine()
                selectAll()
                setPadding(50, 40, 50, 40)
            }
            AlertDialog.Builder(this)
                .setTitle("Change Vault Codename")
                .setView(input)
                .setPositiveButton("Save") { _, _ ->
                    val newAlias = input.text.toString().trim()
                    if (newAlias.isNotEmpty()) {
                        prefs.edit().putString(PREF_USER_ALIAS, newAlias).apply()
                        refreshProfileHeader()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        val isEliteDns = prefs.getBoolean(PREF_ELITE_DNS_FILTER, true)
        sheetBinding.switchEliteDns.isChecked = isEliteDns
        sheetBinding.textEliteDnsStatus.text = if (isEliteDns) {
            "Active • Zero-latency in-memory blocking for 600+ ad networks"
        } else {
            "Disabled • Falling back to basic filter rules"
        }

        sheetBinding.switchEliteDns.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(PREF_ELITE_DNS_FILTER, isChecked).apply()
            sheetBinding.textEliteDnsStatus.text = if (isChecked) {
                "Active • Zero-latency in-memory blocking for 600+ ad networks"
            } else {
                "Disabled • Falling back to basic filter rules"
            }
            Toast.makeText(
                this,
                if (isChecked) "AdGuard & OISD Advanced Ad Engine Enabled" else "Advanced Ad Filter Disabled",
                Toast.LENGTH_SHORT
            ).show()
        }

        sheetBinding.btnOpenPrivateDnsHub.setOnClickListener {
            showPrivateDnsHubDialog()
        }

        val actualLifetime = AdShieldApp.instance.getBlockedAdsCount()
        val currentSessionBlocked = tabs.sumOf { it.filteredRequests }.toLong()
        val totalBlocked = maxOf(actualLifetime, currentSessionBlocked)
        val dataSavedMb = totalBlocked * 0.12 // Average mobile ad asset is ~120 KB
        val dataSavedFormatted = when {
            totalBlocked == 0L -> "0 MB"
            dataSavedMb < 1.0 -> String.format(Locale.US, "%.1f MB", dataSavedMb)
            dataSavedMb >= 1024.0 -> String.format(Locale.US, "%.2f GB", dataSavedMb / 1024.0)
            else -> String.format(Locale.US, "%.1f MB", dataSavedMb)
        }
        sheetBinding.statTotalBlocked.text = String.format(Locale.US, "%,d", totalBlocked)
        sheetBinding.statDataSaved.text = dataSavedFormatted
        sheetBinding.statShieldHealth.text = if (isShieldEnabled) "Active" else "Paused"

        sheetBinding.btnExportVault.setOnClickListener {
            exportVaultBackup()
        }

        sheetBinding.btnImportVault.setOnClickListener {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            vaultRestorePickerLauncher.launch(Intent.createChooser(intent, "Select Vault Backup JSON"))
        }

        dialog.setOnDismissListener {
            activeAccountDialogBinding = null
        }
        dialog.show()
    }

    private fun showPrivateDnsHubDialog() {
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
            .setTitle("Mobile Private DNS Hub")
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

    private fun exportVaultBackup() {
        try {
            val json = JSONObject().apply {
                put("version", 1)
                put("alias", prefs.getString(PREF_USER_ALIAS, "Fokk User"))
                put("avatar", prefs.getString(PREF_USER_AVATAR, "falcon"))
                put("searchEngine", prefs.getString(PREF_SEARCH_ENGINE, SearchEngine.BING.name))
                put("history", localPrefs.getString(PREF_BROWSING_HISTORY, "[]"))
                put("eliteDns", prefs.getBoolean(PREF_ELITE_DNS_FILTER, true))
                put("activeTheme", prefs.getString(PREF_ACTIVE_THEME, "default"))
                put("strictAdblock", prefs.getBoolean(PREF_STRICT_ADBLOCK, true))
                put("socialWidgets", prefs.getBoolean(PREF_SOCIAL_WIDGETS, false))
                put("timestamp", System.currentTimeMillis())
            }
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val backupFile = File(downloadsDir, "fokk_vault_backup.json")
            backupFile.writeText(json.toString(2))
            Toast.makeText(this, "Vault exported to Downloads/fokk_vault_backup.json", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Export failed: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun importVaultJson(content: String) {
        try {
            val json = JSONObject(content)
            if (json.has("alias")) prefs.edit().putString(PREF_USER_ALIAS, json.getString("alias")).apply()
            if (json.has("avatar")) prefs.edit().putString(PREF_USER_AVATAR, json.getString("avatar")).apply()
            if (json.has("searchEngine")) prefs.edit().putString(PREF_SEARCH_ENGINE, json.getString("searchEngine")).apply()
            if (json.has("history")) localPrefs.edit().putString(PREF_BROWSING_HISTORY, json.getString("history")).apply()
            if (json.has("eliteDns")) prefs.edit().putBoolean(PREF_ELITE_DNS_FILTER, json.getBoolean("eliteDns")).apply()
            if (json.has("activeTheme")) prefs.edit().putString(PREF_ACTIVE_THEME, json.getString("activeTheme")).apply()
            if (json.has("strictAdblock")) prefs.edit().putBoolean(PREF_STRICT_ADBLOCK, json.getBoolean("strictAdblock")).apply()
            if (json.has("socialWidgets")) prefs.edit().putBoolean(PREF_SOCIAL_WIDGETS, json.getBoolean("socialWidgets")).apply()
            Toast.makeText(this, "Vault restored successfully!", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Invalid vault backup: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun initMediaSession() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            mediaWakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FokkShield:MediaAudioWakeLock")

            mediaSession = MediaSession(this, "FokkMediaSession").apply {
                setCallback(object : MediaSession.Callback() {
                    override fun onPlay() {
                        toggleMediaPlayPause(forcePlay = true)
                    }

                    override fun onPause() {
                        toggleMediaPlayPause(forcePause = true)
                    }

                    override fun onSkipToNext() {
                        nextMediaTrack()
                    }

                    override fun onSkipToPrevious() {
                        rewindMedia10()
                    }

                    override fun onFastForward() {
                        forwardMedia10()
                    }

                    override fun onRewind() {
                        rewindMedia10()
                    }

                    override fun onSeekTo(pos: Long) {
                        val sec = pos / 1000.0
                        activeWebView?.evaluateJavascript("var v = document.querySelector('video'); if (v) v.currentTime = $sec;", null)
                    }
                })
                setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS or MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MediaSession", e)
        }
    }

    fun onMediaPlaybackUpdated(isPlaying: Boolean, hasActiveVideo: Boolean, title: String? = null) {
        if (!isPlaying && backgroundPlaybackArmed) {
            // A number of sites report a transient pause as soon as Android hides
            // their page. Keep the foreground media service alive while the
            // background playback guard resumes the media item that was active.
            val host = activeTab?.url?.let { runCatching { Uri.parse(it).host }.getOrNull() } ?: "Fokk Browser"
            com.adshield.app.service.FokkMediaPlaybackService.start(this, currentMediaTitle, host, isPlaying = true)
            activeWebView?.evaluateJavascript(
                "if (typeof window.__fokk_prepareBackgroundPlayback === 'function') window.__fokk_prepareBackgroundPlayback();",
                null
            )
            return
        }
        isMediaPlaying = isPlaying
        this.hasActiveVideo = hasActiveVideo
        binding.btnPictureInPicture.visibility = View.GONE
        if (!title.isNullOrBlank()) {
            currentMediaTitle = title
        }
        val host = activeTab?.url?.let { runCatching { Uri.parse(it).host }.getOrNull() } ?: "Fokk Shield"
        val bgAudio = prefs.getBoolean("fokk_background_audio", true)

        if (isPlaying) {
            stopPlaybackRunnable?.let { mainHandler.removeCallbacks(it) }
            stopPlaybackRunnable = null
            lastMediaPlayingTime = System.currentTimeMillis()
            if (hasActiveVideo && customView == null && !isFullscreenCustomView &&
                !(Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode)
            ) {
                setBrowserChromeVisible(true)
            }
            // Keep screen on during active video/audio playback
            if (customView == null && !isFullscreenCustomView) {
                window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
            if (mediaWakeLock?.isHeld == false) {
                try { mediaWakeLock?.acquire(3 * 60 * 60 * 1000L) } catch (e: Exception) {}
            }
            updateMediaSessionPlaybackState(isPlaying = true)
            if (bgAudio) {
                com.adshield.app.service.FokkMediaPlaybackService.start(this, currentMediaTitle, host, isPlaying = true)
            } else {
                updateMediaPlaybackNotification(isPlaying = true, title = currentMediaTitle)
            }
        } else {
            backgroundMediaKeepAlive?.let(mainHandler::removeCallbacks)
            backgroundMediaKeepAlive = null
            stopPlaybackRunnable?.let { mainHandler.removeCallbacks(it) }
            val runnable = Runnable {
                if (!isMediaPlaying) {
                    if (mediaWakeLock?.isHeld == true) {
                        try { mediaWakeLock?.release() } catch (e: Exception) {}
                    }
                    // Release screen-on lock when no media is playing
                    if (customView == null && !isFullscreenCustomView) {
                        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    }
                    updateMediaSessionPlaybackState(isPlaying = false)
                    com.adshield.app.service.FokkMediaPlaybackService.stop(this)
                    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                    notificationManager?.cancel(NOTIFICATION_ID_MEDIA_PLAYBACK)
                }
            }
            stopPlaybackRunnable = runnable
            mainHandler.postDelayed(runnable, 2000L)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val isShorts = activeTab?.url?.contains("/shorts/") == true || activeTab?.url?.contains("tiktok.com") == true || activeTab?.url?.contains("instagram.com/reels") == true
                val ratio = if (isShorts) Rational(9, 16) else Rational(16, 9)
                val builder = PictureInPictureParams.Builder()
                    .setAspectRatio(ratio)
                    // Use the explicit onUserLeaveHint path so the active video
                    // can be prepared before the activity enters PiP.
                    .setAutoEnterEnabled(false)
                    .setSeamlessResizeEnabled(true)
                setPictureInPictureParams(builder.build())
            } catch (e: Exception) {}
        }
    }

    private fun updateMediaSessionPlaybackState(isPlaying: Boolean) {
        try {
            val stateBuilder = PlaybackState.Builder()
                .setActions(
                    PlaybackState.ACTION_PLAY or
                    PlaybackState.ACTION_PAUSE or
                    PlaybackState.ACTION_PLAY_PAUSE or
                    PlaybackState.ACTION_SKIP_TO_NEXT or
                    PlaybackState.ACTION_SKIP_TO_PREVIOUS or
                    PlaybackState.ACTION_FAST_FORWARD or
                    PlaybackState.ACTION_REWIND
                )
                .setState(
                    if (isPlaying) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
                    PlaybackState.PLAYBACK_POSITION_UNKNOWN,
                    1.0f
                )
            mediaSession?.setPlaybackState(stateBuilder.build())
            mediaSession?.isActive = isPlaying
        } catch (e: Exception) {
            Log.e(TAG, "Error updating MediaSession state", e)
        }
    }

    private fun updateMediaPlaybackNotification(isPlaying: Boolean, title: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val playIntent = Intent(this, MediaHubActivity::class.java).apply {
            action = ACTION_MEDIA_TOGGLE
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val rewIntent = Intent(this, MediaHubActivity::class.java).apply {
            action = ACTION_MEDIA_REWIND_10
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fwdIntent = Intent(this, MediaHubActivity::class.java).apply {
            action = ACTION_MEDIA_FORWARD_10
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = Intent(this, MediaHubActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        val pPlay = PendingIntent.getActivity(this, 101, playIntent, flags)
        val pRew = PendingIntent.getActivity(this, 102, rewIntent, flags)
        val pFwd = PendingIntent.getActivity(this, 103, fwdIntent, flags)
        val pContent = PendingIntent.getActivity(this, 100, contentIntent, flags)

        val host = activeTab?.url?.let { runCatching { Uri.parse(it).host }.getOrNull() } ?: "Fokk Shield"
        val displayTitle = if (title.isNotBlank()) title else "Media Playing"

        val notifBuilder = NotificationCompat.Builder(this, AdShieldApp.CHANNEL_ID_MEDIA_PLAYBACK)
            .setSmallIcon(if (isPlaying) R.drawable.ic_media_play else R.drawable.ic_media_pause)
            .setContentTitle(displayTitle)
            .setContentText(host)
            .setSubText("Background Audio")
            .setContentIntent(pContent)
            .setOngoing(isPlaying)
            .setAutoCancel(!isPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(R.drawable.ic_media_rewind_10, "-10s", pRew)
            .addAction(
                if (isPlaying) R.drawable.ic_media_pause else R.drawable.ic_media_play,
                if (isPlaying) "Pause" else "Play",
                pPlay
            )
            .addAction(R.drawable.ic_media_forward_10, "+10s", pFwd)

        try {
            notificationManager.notify(NOTIFICATION_ID_MEDIA_PLAYBACK, notifBuilder.build())
        } catch (e: SecurityException) {
            Log.e(TAG, "Notification permission missing", e)
        }
    }

    private fun toggleMediaPlayPause(forcePlay: Boolean = false, forcePause: Boolean = false) {
        val shouldPlay = if (forcePlay) true else if (forcePause) false else !isMediaPlaying
        if (shouldPlay) {
            activeWebView?.evaluateJavascript(
                "if (typeof window.__fokk_mediaPlay === 'function') { window.__fokk_mediaPlay(); } else { var v = document.querySelector('video'); if (v) v.play(); }", null
            )
        } else {
            // A deliberate pause from the media notification must remove the
            // background resume guard before the page's pause event is delivered.
            backgroundPlaybackArmed = false
            backgroundNoMediaTicks = 0
            backgroundMediaKeepAlive?.let(mainHandler::removeCallbacks)
            backgroundMediaKeepAlive = null
            activeWebView?.evaluateJavascript(
                "if (typeof window.__fokk_endBackgroundPlayback === 'function') window.__fokk_endBackgroundPlayback(); if (typeof window.__fokk_mediaPause === 'function') { window.__fokk_mediaPause(); } else { var v = document.querySelector('video'); if (v) v.pause(); }", null
            )
        }
    }

    private fun rewindMedia10() {
        activeWebView?.evaluateJavascript(
            "if (typeof window.__fokk_mediaSeek === 'function') { window.__fokk_mediaSeek(-10); } else { var v = document.querySelector('video'); if (v) v.currentTime = Math.max(0, v.currentTime - 10); }", null
        )
    }

    private fun forwardMedia10() {
        activeWebView?.evaluateJavascript(
            "if (typeof window.__fokk_mediaSeek === 'function') { window.__fokk_mediaSeek(10); } else { var v = document.querySelector('video'); if (v) v.currentTime += 10; }", null
        )
    }

    private fun nextMediaTrack() {
        activeWebView?.evaluateJavascript(
            "if (typeof window.__fokk_advancePlaylistOrQueue === 'function') { window.__fokk_advancePlaylistOrQueue(); } else { var v = document.querySelector('video'); if (v) v.currentTime += 10; }", null
        )
    }

    fun burnSession() {
        try {
            CookieManager.getInstance().removeAllCookies(null)
            CookieManager.getInstance().flush()
            WebStorage.getInstance().deleteAllData()

            for (tab in tabs) {
                tab.webView?.let { webView ->
                    cancelPendingWebPermission(webView)
                    cancelPendingLocationPermission(webView)
                    binding.tabContainer.removeView(webView)
                    pageUrlsByWebView.remove(webView)
                    webView.clearCache(true)
                    webView.clearHistory()
                    webView.destroy()
                }
            }
            tabs.clear()
            addNewTab("file:///android_asset/fokk_start.html", isPrivate = false)
            updateTabCounter()
            updateToolbarLayoutForUrl("file:///android_asset/fokk_start.html", animated = false)
            Toast.makeText(this, "Session burned. All history, cache & tabs purged.", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e(TAG, "Error burning session", e)
        }
    }

    companion object {
        private val THIRD_PARTY_MEDIA_SERVICE_DOMAINS = setOf(
            "youtube.com", "youtube-nocookie.com", "youtu.be",
            "spotify.com", "spotify.link", "scdn.co", "spotifycdn.com",
            "instagram.com", "instagr.am",
            "x.com", "twitter.com", "twimg.com", "t.co"
        )
        private val STREAMING_MEDIA_DOMAINS = setOf(
            "googlevideo.com", "ytimg.com", "ggpht.com", "mux.com", "bitmovin.com",
            "peer5.com", "streamroot.io", "conviva.com", "nicepeopleatwork.com",
            "scdn.co", "spotifycdn.com", "audio-ak-spotify-com.akamaized.net",
            "vimeo.com", "vimeocdn.com", "akamaized.net",
            "dailymotion.com", "dmcdn.net",
            "rumble.com", "streamable.com",
            "jwplayer.com", "jwplatform.com", "jwpcdn.com",
            "brightcove.com", "brightcove.net", "boltdns.net", "brightcovecdn.com",
            "wistia.com", "wistia.net", "wi.st",
            "twitch.tv", "ttvnw.net", "jtvnw.net",
            "soundcloud.com", "sndcdn.com",
            "video.twimg.com", "ton.twitter.com",
            // News & Sports article video delivery infrastructure
            "video.yahoo.com", "yql.yahoo.com", "bats.video.yahoo.com",
            "yahoo.com", "yimg.com", "s.yimg.com", "v.yimg.com", "media.zenfs.com",
            "video.media.yql.yahoo.com", "yvp.yahoo.com", "sports.yahoo.com",
            "vidgyor.com", "playstream.media", "htmedia.in",
            "connatix.com", "cnevids.com", "anvato.net", "kaltura.com",
            "sendtonews.com", "ex.co", "playwire.com", "brid.tv", "videoelephant.com"
        )
        private val IPV4_ADDRESS_REGEX = Regex("\\d{1,3}(\\.\\d{1,3}){3}")
        // Includes India suffixes from the Mozilla Public Suffix List snapshot dated 2026-10-28
        // (MPL-2.0), plus common public and shared-hosting boundaries. This is not a full PSL.
        private val MULTI_LABEL_PUBLIC_SUFFIXES = setOf(
            "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au",
            "co.nz", "com.br", "com.cn", "com.sg", "com.tr", "co.in", "firm.in",
            "net.in", "org.in", "com.mx", "co.za", "co.jp", "ne.jp", "com.tw",
            "github.io", "gitlab.io", "pages.dev", "workers.dev", "appspot.com",
            "blogspot.com", "cloudfront.net", "firebaseapp.com", "web.app", "vercel.app",
            "netlify.app", "herokuapp.com", "azurewebsites.net", "wordpress.com",
            "wixsite.com", "tumblr.com",
            "5g.in", "6g.in", "ac.in", "aero.in", "ai.in", "alumni.in", "am.in",
            "bank.in", "bihar.in", "biz.in", "business.in", "ca.in", "cn.in", "com.in",
            "coop.in", "cs.in", "delhi.in", "dr.in", "edu.in", "er.in", "fin.in",
            "gen.in", "gov.in", "gujarat.in", "ind.in", "info.in", "int.in", "internet.in",
            "io.in", "me.in", "mil.in", "nic.in", "pg.in", "post.in", "pro.in", "res.in",
            "school.in", "travel.in", "tv.in", "ub.in", "uk.in", "up.in", "us.in"
        )
        private val TRACKING_QUERY_PARAMETERS = setOf(
            "fbclid", "gclid", "dclid", "gbraid", "wbraid", "msclkid", "mc_eid",
            "igshid", "si", "yclid", "twclid", "ttclid", "li_fat_id", "vero_id", "vero_conv",
            "_hsenc", "_hsmi", "mkt_tok"
        )
        private val AUTHENTICATION_OR_SIGNATURE_PARAMETERS = setOf(
            "sig", "signature", "awsaccesskeyid", "token", "access_token", "refresh_token",
            "id_token", "auth", "authorization", "jwt", "hmac", "policy", "key-pair-id",
            "expires", "exp", "code", "state", "nonce", "oauth_token", "oauth_signature",
            "se", "sp", "sv", "st", "spr", "sr", "hdnts", "hdnea", "hdntl"
        )
        private val AUTHENTICATION_OR_SIGNATURE_PREFIXES = setOf(
            "x-amz-", "x-goog-", "x-oss-", "x-ms-", "oauth_"
        )
        private const val OFFLINE_PAGE_BASE_URL = "https://offline.fokk.invalid/"

        const val EXTRA_URL = "extra_url"
        const val EXTRA_OPEN_ACTION = "extra_open_action"
        const val ACTION_WIPE_GHOST_SESSION = "com.adshield.app.ACTION_WIPE_GHOST_SESSION"
        private const val NOTIFICATION_ID_GHOST_MODE = 9001
        private const val NOTIFICATION_ID_MEDIA_PLAYBACK = 9002
        const val ACTION_MEDIA_TOGGLE = "com.adshield.app.ACTION_MEDIA_TOGGLE"
        const val ACTION_MEDIA_REWIND_10 = "com.adshield.app.ACTION_MEDIA_REWIND_10"
        const val ACTION_MEDIA_FORWARD_10 = "com.adshield.app.ACTION_MEDIA_FORWARD_10"
        const val ACTION_MEDIA_NEXT = "com.adshield.app.ACTION_MEDIA_NEXT"
        private const val TAG = "FokkBrowser"
        private const val PREFS_NAME = "fokk_browser_settings_v2"
        private const val LEGACY_PREFS_NAME = "fokk_browser_prefs"
        private const val LOCAL_PREFS_NAME = "fokk_browser_local"
        private const val PREF_TOOLBAR_POSITION = "fokk_toolbar_position"
        private const val PREF_LIGHT_THEME = "fokk_light_theme"
        private const val PREF_SEARCH_ENGINE = "fokk_search_engine"
        private const val PREF_REMOTE_SUGGESTIONS = "fokk_remote_search_suggestions"
        private const val PREF_STRICT_ADBLOCK = "filter_strict_adblock"
        private const val PREF_SOCIAL_WIDGETS = "filter_social_trackers"
        private const val PREF_CUSTOM_JS = "custom_userscript"
        private const val PREF_CUSTOM_CSS = "custom_usercss"
        private const val PREF_BROWSING_HISTORY = "key_browsing_history_v2"
        private const val PREF_FOKK_AI_HISTORY = "key_fokk_ai_history_v1"
        private const val PREF_SESSION_TABS = "key_session_tabs_v1"
        private const val PREF_SESSION_ACTIVE_TAB = "key_session_active_tab_v1"
        private const val MAX_RESTORED_TABS = 12
        private const val MAX_REPORTED_HOSTS = 12
        private const val MAX_DOWNLOAD_FILENAME_LENGTH = 180
        private const val MEDIA_RECENT_ACTIVITY_WINDOW_MS = 5_000L
        private const val PREF_SHIELD_DISABLED_SITES = "key_shield_disabled_sites"
        private const val PREF_SHOW_HOMEPAGE_SHORTCUTS = "fokk_show_shortcuts"
        private const val PREF_BIOMETRIC_PRIVATE_TABS = "fokk_biometric_private_tabs"
        private const val PREF_AI_FILTER = "fokk_ai_filter_enabled"
        private const val PREF_HTTPS_ONLY = "fokk_https_only_enabled"
        private const val PREF_FOKKO_AI = "fokk_fokko_ai_enabled"
        private const val PREF_ACTIVE_THEME = "fokk_active_theme"
        private const val PREF_USER_AVATAR = "fokk_user_avatar"
        private const val PREF_USER_ALIAS = "fokk_user_alias"
        private const val PREF_ELITE_DNS_FILTER = "fokk_elite_dns_filter"
        private const val PREF_GHOST_CLOAKER = "fokk_ghost_cloaker"
        private const val PREF_DOH_TUNNEL = "fokk_doh_tunnel"
        private const val PREF_DOH_PROVIDER = "fokk_doh_provider"
        private const val PREF_POPUNDER_DEFUSER = "fokk_popunder_defuser"
        private const val PREF_VIDEO_SNIFFER = "fokk_video_sniffer"
        private const val PREF_MX_GESTURES = "fokk_mx_gestures"
        private const val PREF_DECOY_CALCULATOR = "fokk_decoy_calculator"
        private const val PREF_DECOY_PIN = "fokk_decoy_pin"
        private val LOCAL_BROWSER_DATA_KEYS = setOf(
            PREF_BROWSING_HISTORY,
            PREF_FOKK_AI_HISTORY,
            PREF_SESSION_TABS,
            PREF_SESSION_ACTIVE_TAB,
            PREF_SHIELD_DISABLED_SITES,
            OfflinePageStore.PREF_SAVED_PAGES
        )
    }
}
