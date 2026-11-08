# Fokk Browser Project

<p align="center">
  <img width="800" alt="Fokk Browser Project" src="https://github.com/user-attachments/assets/70e9a0ca-0f16-46ad-ae70-c9cf176e186e" />
</p>

<p align="center">
  <a href="https://github.com/Kimmojiraja/fokk-project/releases"><img src="https://img.shields.io/github/v/release/Kimmojiraja/fokk-project?label=Latest%20Release&color=00c853&style=flat-square" alt="Release"></a>
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Linux%20%7C%20Windows%20%7C%20macOS-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Adblock-100%25%20On--Device-crimson?style=flat-square" alt="Adblock">
  <img src="https://img.shields.io/badge/Telemetry-Zero%20Tracking-darkgreen?style=flat-square" alt="Privacy">
  <img src="https://img.shields.io/badge/License-Apache%202.0%20%2F%20MIT-blueviolet?style=flat-square" alt="License">
</p>

**Fokk Browser Project** is an ultra-fast, privacy-first, tracker-free web browser engineered for clean media playback, built-in torrent streaming, and distraction-free web reading across **Android, Linux, Windows, and macOS**.

---

## ⚡ Multi-Platform Downloads & Matrix

Choose your operating system below to download the latest stable release:

| Platform | Format / Architecture | Status | Direct Download |
| :--- | :--- | :--- | :--- |
| **Android** | APK (ARM64, ARMv7, x86_64) | Stable (`v2.3.5`) | [⬇️ Download Fokk.apk](https://github.com/Kimmojiraja/fokk-project/releases/latest/download/Fokk.apk) |
| **Linux** | Debian / Ubuntu / Mint (`.deb`) | Stable (`desktop-v1.0.0`) | [⬇️ Download .deb](https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.0.0/fokk-browser_1.0.0_amd64.deb) |
| **Linux** | Universal Linux (`.AppImage`) | Stable (`desktop-v1.0.0`) | [⬇️ Download .AppImage](https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.0.0/Fokk%20Browser-1.0.0.AppImage) |
| **Windows** | Windows 10/11 64-bit (`.zip` Portable) | Stable (`desktop-v1.0.0`) | [⬇️ Download Windows .zip](https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.0.0/Fokk%20Browser-1.0.0-win.zip) |
| **macOS** | macOS 11+ Intel & Apple Silicon (`.zip`) | Stable (`desktop-v1.0.0`) | [⬇️ Download macOS .zip](https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.0.0/Fokk%20Browser-1.0.0-mac.zip) |

All releases, source packages, and changelogs can be browsed on the [GitHub Releases Page](https://github.com/Kimmojiraja/fokk-project/releases).

---

## 🏷️ Release Versioning Separation

Fokk Browser maintains dedicated, independent release cycles for mobile and desktop to ensure platform stability:

- **Android Releases** are tagged with semantic version numbers `v{version}` (e.g. `v2.3.5`).
  - Assets: `app-debug.apk` / `Fokk.apk`.
  - In-app updates are coordinated via `version.json` and Android's native `AppUpdateManager`.
- **Desktop Releases** are tagged with the `desktop-v{version}` prefix (e.g. `desktop-v1.0.0`).
  - Assets: Linux `.deb` & `.AppImage`, Windows `.zip` / `.exe`, macOS `.zip`.
  - In-app updates are coordinated via the desktop 1-click background updater in the About Hub.

---

## 🖥️ Desktop Superpowers (Linux, Windows, macOS)

- **uBlock Origin Adblock Architecture**:
  - Intercepts player payloads (`ytInitialPlayerResponse` and `JSON.parse`) to strip `adPlacements`, `playerAds`, and `adSlots`.
  - **Zero Speed Tampering**: Completely avoids artificial fast-forwarding or `playbackRate = 16.0` manipulation. Videos play natively at 1x with 0 ads.
  - **Preserves Native Navigation**: Zero tampering with element layout prototypes, keeping YouTube’s logo, sidebar, and player settings gear menu 100% intact.
- **Browsing History Hub**:
  - Full real-time visited URL and title tracking.
  - Interactive search bar, chronological timestamps, 1-click open in new tab, single item deletion `(✕)`, and a "Clear All" action.
- **System Downloads Manager Hub**:
  - Real-time download progress tracking with file size, progress bars, "Open File", "Show in Folder", and "Open Downloads Folder".
- **Customizable User Profile**:
  - Upload custom profile pictures/avatars via a native file picker dialog.
  - Customizable display name ("Shadow Falcon") with local persistence.
- **Interactive Shortcut Tiles**:
  - Fetches 128px high-resolution Google favicons with letter fallback.
  - Hover `(✎)` Edit and `(✕)` Delete actions on every tile.
  - `+ Add Tile` modal with instant `Enter` key save.
- **Cohesive Dual Themes**:
  - **Obsidian Dark Mode**: Deep black styling for late-night viewing.
  - **Daylight Light Mode**: Clean, soft off-white tab strip (`#E2E8F0`), active tab `#FFFFFF`, toolbar `#FFFFFF`, and light start page.
- **Cross-Tab Session Persistence**:
  - Standard tabs share `persist:fokk_default_session` so logins, cookies, and personalized feeds (such as YouTube home feeds) remain persistent across new tabs.
- **1-Click In-App Background Updater**:
  - Integrated in the About Hub to query GitHub Releases, download platform binaries with live progress, and launch the update in one click.

---

## 📱 Android Superpowers

- **Document-Start Video & Social Filtering**:
  - Intercepts page responses and network payloads at document start (`WebViewCompat.addDocumentStartJavaScript`).
  - Strips ad metadata from YouTube player responses and Instagram feeds before the player initializes.
- **In-Browser WebTorrent & Magnet Streaming**:
  - Stream audio and video directly in your browser tab from magnet links and `.torrent` files over native WebRTC.
- **Dual-Deck Split Viewport**:
  - Run two live, independent web tabs simultaneously in a stacked vertical viewport for multitasking.
- **1-Tap Paywall Mirror & Reader Tools**:
  - Instant access to clean, archived mirrors of paywalled news articles directly from the address bar.
  - Integrated high-contrast reader view that strips sticky banners, popups, and visual clutter.
  - On-device text summarizer providing quick bullet points and reading time estimates.
- **Isolated Private Profile (`fokk_private`)**:
  - Private tabs operate in a physically isolated WebView process and file directory (`fokk_private`), purged upon exit.
- **Ergonomic Animated Command Bar**:
  - Bottom-positioned navigation card engineered for one-handed reach with fluid expansion and quick engine switcher.
- **AMOLED Pure-Black Dark Theme**:
  - Hardware-accelerated dark engine formatting web backgrounds to true `#000000` black for OLED battery savings.
- **Default Search Engine & Quick Switching**:
  - Ships with **Microsoft Bing** as default for privacy-preserving web lookups and fast image indexing, with 1-tap switching between DuckDuckGo, Brave, Google, Startpage, and Ecosia.

---

## 🛡️ Privacy Architecture

- **100% On-Device Execution**:
  All request blocking, cosmetic filtering, and payload sanitization occur locally in memory on your device. Browsing requests, search queries, and navigation history are never routed through intermediate proxy servers.
- **50,000+ Curated Network Rules**:
  Blocks tracking beacons, telemetry endpoints, sponsored media slots, and malicious domains out of the box.
- **Encrypted DNS Integration**:
  Supports encrypted DNS-over-HTTPS (DoH) and Private DNS providers:
  - AdGuard DNS (`dns.adguard-dns.com`)
  - Mullvad Privacy DNS (`adblock.dns.mullvad.net`)
  - Cloudflare Security (`security.cloudflare-dns.com`)
  - Control D (`p2.freedns.controld.com`)
- **Zero Telemetry**:
  Zero analytics libraries, zero tracking SDKs, and zero background telemetry services.

---

## 🛠️ Building from Source

### Android Build
- **Requirements**: JDK 17, Android SDK 34, Gradle 8+.

```bash
git clone https://github.com/Kimmojiraja/fokk-project.git
cd fokk-project
./gradlew assembleDebug
```
Output APK: `app/build/outputs/apk/debug/app-debug.apk`

### Desktop Build (Linux, Windows, macOS)
- **Requirements**: Node.js 20+, npm.

```bash
cd desktop
npm install

# Build Linux (.deb & .AppImage)
npm run dist:linux

# Build Windows (.zip)
npm run dist:win

# Build macOS (.zip)
npm run dist:mac

# Build all packages simultaneously
npm run dist:all
```
Output binaries are generated in `desktop/dist/`.

---

## 🤝 Community & Contributing

We welcome pull requests, bug reports, adblock defuser improvements, and feature ideas from everyone!

Please read our [**CONTRIBUTORS.md**](CONTRIBUTORS.md) for contribution guidelines, code architecture standards, and instructions on how to get involved.

---

## 💖 Support & Sponsoring

Fokk Browser is independently developed without venture funding or telemetry monetization. Every contribution directly powers tracker-free development:

### Online Sponsoring
- **GitHub Sponsors**: [Sponsor @Kimmojiraja on GitHub](https://github.com/sponsors/Kimmojiraja) (Monthly or one-time)
- **Buy Me a Coffee**: [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-support-yellow?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/k_raja)

### Direct Cryptocurrency Support
| Cryptocurrency | Network | Receiving Address |
| :--- | :--- | :--- |
| **Bitcoin (BTC)** | Bitcoin Native | `bc1qwxnv6uphj0ke8q50gdx6ew8j3lgvwhk6k2kaet` |
| **Ethereum (ETH)** | ERC20 | `0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525` |
| **BNB Smart Chain (BNB)** | BEP20 | `0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525` |
| **Solana (SOL)** | Solana SPL | `DqgAgDj4PjvR4K1wtYfpaZuYNeNZgj2fQoKnXApWKuTj` |

---

## 📜 License

Fokk Browser Project is open-source software licensed under the **Apache License, Version 2.0** (Android components) and **MIT License** (Desktop components). See the [LICENSE](LICENSE) file for complete details.

