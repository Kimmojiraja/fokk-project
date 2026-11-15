# Fokk Pro VPN rollout

Fokk Pro VPN uses a real WireGuard tunnel, not a local forwarding proxy. The Android app embeds the WireGuard userspace backend and requests Android VPN consent before bringing a profile up.

## Server control plane

Operate Fokk-owned WireGuard exit servers per region. The provisioning API must authenticate the Pro user, create a per-device peer, and return a short-lived standard WireGuard configuration. Never ship a shared client private key in the app.

The signed server catalogue format is illustrated in `fokk-pro-vpn-server-manifest.example.json`. The app should reject expired catalogues, unknown signing keys, endpoints outside the selected profile, and unsigned profile changes.

## Required production safeguards

- One WireGuard keypair per device and server-side peer revocation.
- IPv4 and IPv6 default routes plus Fokk-controlled DNS inside every profile.
- Handshake watchdog; show an error and block browser traffic rather than presenting a false connected state.
- Kill switch/always-on VPN exposed through Android system settings after the first successful connection.
- Independent exit-IP, DNS, and IPv6 leak checks from inside the active tunnel.
- Region selection should only list active, health-checked servers; never fabricate country locations.

## Desktop delivery

Desktop requires a signed, bundled WireGuard runtime/driver for Windows, macOS, and Linux, plus elevated installation where the operating system requires it. Electron's proxy layer is useful for browser-only Tor/SOCKS routing, but it is not a replacement for a full-device WireGuard tunnel. The desktop client must fail closed when its native runtime or selected server is unavailable.

## License compliance

Keep third-party notices and license texts in the shipped application and release artefacts. Product UI can be branded Fokk Pro VPN; notices belong in an open-source/legal screen.
