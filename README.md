# Fokk Browser Project

> **The lightweight browser that fact-checks what you read, privately.**

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

Fokk was created out of frustration with how modern web browsers have quietly turned against their users. What began as a tool for personal computing has evolved into an engine for corporate data collection, where every navigation event is measured, monetized, and matched against personal profiles. Fokk is built from the ground up on a simple principle: your browser should work exclusively for you. It contains zero analytics SDKs, zero background telemetry services, and zero network logging. All content filtering, cosmetic sanitization, and routing decisions happen strictly in local memory on your device.

At the foundation of this speed is the AdShield engine. Rather than relying on fragile DOM-level cosmetic hiding or artificial playback manipulation like fast-forwarding ads at extreme speeds, AdShield operates at the earliest network boundary. By intercepting web requests and player payloads at document start (`document-start`), AdShield completely neutralizes ad slots, sponsored media sequences, and telemetry beacons before they can load into memory. This allows web applications to run at their intended speed without broken layouts or flickering player interfaces. Combined with Fokk's native media engine, users experience uninterrupted background audio, picture-in-picture video, and in-browser WebTorrent streaming directly over WebRTC without installing external downloaders or media utilities.

To protect against internet service provider surveillance and network traffic fingerprinting while browsing, Fokk incorporates Fokk Mesh—an in-browser privacy mesh utilizing oblivious split-routing to separate user client IP addresses from destination hostnames. Unlike whole-device VPN tunnels that route unrelated background app traffic, Fokk Mesh specifically defends web requests within the active browser session across independent oblivious hops. To further resist deep packet inspection (DPI) and statistical traffic analysis, Fokk applies Nym Mixnet-inspired packet timing obfuscation with subtle micro-jitter, effectively preventing surveillance nodes from correlating request and response streams under a strict zero-log operational policy.

In an online environment increasingly flooded with automated disinformation, deceptive claims, and synthetic media, private browsing alone is no longer enough. The Fokk AI Truth Engine brings real-time forensic auditing directly into your browsing experience. Operating locally with structured heuristic models and verifiable evidence databases, the Truth Engine evaluates claims, detects subtle media bias, and flags coordinated manipulation directly inside social feeds across platforms like X, Reddit, Threads, and YouTube. It provides instant, objective context badges right where you read, helping you navigate complex narratives with clarity while ensuring your browsing habits remain strictly private.

Fokk is engineered for daily productivity across mobile and desktop. On Android, a fluid one-handed bottom command bar, dual-deck split viewports for simultaneous two-page browsing, an isolated disposable private profile (`fokk_private`) that completely purges cookies and caches on exit, biometric security locks, and a true AMOLED pure black dark theme deliver maximum battery efficiency and comfort. On Linux, Windows, and macOS, Fokk provides persistent multi-tab workspace sessions, a comprehensive history search engine, a dedicated downloads manager, and customizable start page tiles, maintaining identical privacy guarantees across all your devices.

---

## Multi-Platform Downloads and Version Matrix

Choose your operating system below to download the latest stable release:

| Platform | Architecture / Format | Version | Direct Download |
| :--- | :--- | :--- | :--- |
| Android | APK (ARM64, ARMv7, x86_64) | Stable (v2.6.6) | [Download Fokk.apk](https://github.com/Kimmojiraja/fokk-project/releases/download/v2.6.6/app-debug.apk) |
| Linux | Debian / Ubuntu / Mint (.deb) | Stable (desktop-v1.3.2) | [Download .deb](https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.3.2/fokk-browser_1.3.2_amd64.deb) |
| Linux | Universal Linux (.AppImage) | Stable (desktop-v1.3.2) | [Download .AppImage](https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.3.2/Fokk.Browser-1.3.2.AppImage) |
| Windows | Windows 10/11 64-bit (.exe Installer) | Stable (desktop-v1.3.2) | [Download Windows .exe](https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.3.2/Fokk.Browser.1.3.2.exe) |
| macOS | macOS 11+ Intel & Apple Silicon (.zip) | Stable (desktop-v1.3.2) | [Download macOS .zip](https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.3.2/Fokk.Browser-1.3.2-arm64-mac.zip) |

All release packages, source archives, and cryptographic hashes can be reviewed on the [GitHub Releases Page](https://github.com/Kimmojiraja/fokk-project/releases).

---

## Fokk Pro and Sustainability

Fokk is an independent, community-driven project with a clear freemium model designed to ensure long-term development without compromising user privacy:

- **100% Free Core Browser**: All essential browser features—AdShield network filtering, native media and background audio playback, WebTorrent streaming, dual-deck split viewport, isolated private sandboxing, high-contrast reader mode, and automatic optimal mesh routing—are completely free and open.
- **Fokk Pro ($4.99 / month or $39.99 / year)**: Dedicated to users requiring global infrastructure routing and active narrative intelligence:
  1. **Fokk Mesh Pro**: Dedicated regional gateways across Americas, Europe, and Asia-Pacific with Oblivious Split-Trust routing, Nym packet micro-jitter timing protection, and custom enterprise endpoints.
  2. **Fokk AI Truth Engine**: Real-time forensic verification, community fact checks, and bias audits across social media feeds.

---

## Building from Source

### Android Build
Requirements: JDK 17, Android SDK 34, Gradle 8+.

```bash
git clone https://github.com/Kimmojiraja/fokk-project.git
cd fokk-project
./gradlew assembleDebug
```
Output APK: `app/build/outputs/apk/debug/app-debug.apk`

### Desktop Build (Linux, Windows, macOS)
Requirements: Node.js 20+, npm.

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
Output packages are generated in `desktop/dist/`.

---

## Community and Sponsoring

Fokk Browser is developed independently without venture capital or advertising monetization. Every contribution directly powers tracker-free development:

### Direct Sponsorship
- GitHub Sponsors: [Sponsor @Kimmojiraja on GitHub](https://github.com/sponsors/Kimmojiraja) (Monthly or one-time)

### Cryptocurrency Support
| Asset | Network | Receiving Address |
| :--- | :--- | :--- |
| Bitcoin (BTC) | Bitcoin Native | `bc1qwxnv6uphj0ke8q50gdx6ew8j3lgvwhk6k2kaet` |
| Ethereum (ETH) | ERC20 | `0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525` |
| BNB Smart Chain (BNB) | BEP20 | `0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525` |
| Solana (SOL) | Solana SPL | `DqgAgDj4PjvR4K1wtYfpaZuYNeNZgj2fQoKnXApWKuTj` |

---

## License

Fokk Browser Project is open-source software licensed under the **Apache License, Version 2.0** (Android components) and **MIT License** (Desktop components). See the [LICENSE](LICENSE) file for complete details.
