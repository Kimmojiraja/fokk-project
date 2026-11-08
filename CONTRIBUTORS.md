# Fokk Browser Project Contributors & Guidelines

Thank you for your interest in contributing to the **Fokk Browser Project**! We are building an ultra-fast, tracker-free, zero-compromise privacy browser across Android, Linux, Windows, and macOS.

---

## 🌟 Maintainer & Lead Architect

- **Kimmojiraja** ([@Kimmojiraja](https://github.com/Kimmojiraja))
  - *Project Founder, Lead Architect & Core Maintainer*
  - Repository: [github.com/Kimmojiraja/fokk-project](https://github.com/Kimmojiraja/fokk-project)

---

## 🤝 Community Contributors

We gratefully acknowledge every community member who helps test, debug, optimize, and expand Fokk Browser:

| Contributor | Focus Area | Profile |
| :--- | :--- | :--- |
| **Kimmojiraja** | Android Architecture, Desktop Core, Shield Engine | [@Kimmojiraja](https://github.com/Kimmojiraja) |
| *Open for Contributors* | Adblock Defusers, Multi-Platform Builds, UI/UX | *Submit a PR!* |

> Want to see your name here? Submit a pull request fixing a bug, adding a feature, improving ad defusers, or updating documentation, and add your name to this table!

---

## 🚀 How You Can Contribute

### 1. Adblocking & Shield Defusers
- Expand curated adblock filters and cosmetic defusers in `desktop/src/adblock.js` and `app/src/main/assets/adblock_rules_curated.txt`.
- Improve YouTube, Instagram, X (Twitter), and Reddit ad/tracker sanitization following **uBlock Origin standards** (clean payload/DOM sanitization, zero video speed tampering).

### 2. Desktop Browser Development (Linux, Windows, macOS)
- Electron & Chromium `<webview>` enhancements in `desktop/src/`.
- UI/UX refinements, CSS theming (Obsidian Dark / Daylight Light) in `desktop/src/ui/`.
- History, Downloads Manager, and Shortcut Tile capabilities.

### 3. Android Mobile Development
- Kotlin, AndroidX WebKit, and Android Media Hub in `app/src/main/`.
- WebTorrent protocol optimizations and split-deck multi-window performance.

### 4. Localization & Documentation
- Translate UI strings into new languages.
- Improve guides, installation documentation, and keyboard shortcut sheets.

### 5. Bug Reports & Feature Requests
- Test releases on different operating systems and report issues via [GitHub Issues](https://github.com/Kimmojiraja/fokk-project/issues).

---

## 📐 Core Engineering Standards

To maintain security, privacy, and architectural cleanliness, all contributions must adhere to these rules:

1. **Strict 100% On-Device Privacy**:
   - Zero remote proxy routing, zero third-party telemetry, and zero tracking SDKs.
   - All network blocking and cosmetic filtering must execute locally on the user's machine.
2. **Platform Isolation**:
   - The Android mobile codebase (`app/`) and the Desktop codebase (`desktop/`) must remain clean and modular. Changes targeting Desktop should not inadvertently modify mobile assets unless intended.
3. **No Artificial Playback Tampering**:
   - Never use video speed acceleration hacks (e.g. `playbackRate = 16.0` or duration jumping) for video adblocking. All adblocking must follow native payload sanitization (uBlock Origin pattern).
4. **Clean Code & Testing**:
   - Ensure syntax validity (`node -c` on desktop files, `./gradlew assembleDebug` on Android).
   - Use meaningful, conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`).

---

## 🛠️ Getting Started with Development

1. **Fork the Repository**:
   Click the **Fork** button on GitHub and clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/fokk-project.git
   cd fokk-project
   ```

2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/my-enhancement
   ```

3. **Make Your Changes & Test**:
   - For Desktop:
     ```bash
     cd desktop
     npm install
     npm start
     ```
   - For Android:
     ```bash
     ./gradlew assembleDebug
     ```

4. **Commit & Open a Pull Request**:
   Push your branch to GitHub and submit a Pull Request describing your changes and verification steps.

---

## 💖 Supporting the Project

If you find Fokk Browser helpful, consider backing ongoing tracker-free development:

- **GitHub Sponsors**: [github.com/sponsors/Kimmojiraja](https://github.com/sponsors/Kimmojiraja)
- **Buy Me a Coffee**: [buymeacoffee.com/k_raja](https://buymeacoffee.com/k_raja)
- **Bitcoin (BTC)**: `bc1qwxnv6uphj0ke8q50gdx6ew8j3lgvwhk6k2kaet`
- **Ethereum (ETH)**: `0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525`
- **Solana (SOL)**: `DqgAgDj4PjvR4K1wtYfpaZuYNeNZgj2fQoKnXApWKuTj`

Thank you for helping keep the web fast, private, and open for everyone! ❤️
