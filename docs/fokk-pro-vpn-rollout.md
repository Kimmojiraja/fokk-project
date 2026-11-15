# Fokk Pro VPN deployment requirements

## Current implementation status

- Android applies a custom SOCKS or HTTP proxy to Fokk WebViews. It does not provide a system-wide VPN or a built-in remote exit server.
- Desktop can route Electron browser sessions through a compatible Tor SOCKS endpoint or a reachable custom SOCKS/HTTP proxy. A country-specific exit is not guaranteed.
- No Fokk-owned VPN server fleet, account provisioning API, or signed server catalogue is configured in this repository. The browser cannot change a user's public IP by itself; it needs a reachable remote exit.

The sample catalogue in `fokk-pro-vpn-server-manifest.example.json` is a format example only. Its example hostname and keys are not deployable credentials.

## Requirements before selling a full VPN plan

Operate Fokk-owned WireGuard exit servers per region. The provisioning API must authenticate each Pro account, create a per-device peer, and return a short-lived configuration. Never ship a shared client private key in the app.

The signed catalogue must use pinned signing keys and be rejected when expired, unsigned, or inconsistent with the selected profile. Region choices must come from active, health-checked servers rather than static labels.

Required safeguards:

- One WireGuard keypair per device with server-side peer revocation.
- IPv4 and IPv6 default routes plus Fokk-controlled DNS in each profile.
- Handshake monitoring and fail-closed behavior when a route drops.
- Android system VPN consent and always-on/lockdown support where available.
- Desktop tunnel runtimes and required operating-system privileges for Windows, macOS, and Linux.
- Exit-IP, DNS, and IPv6 leak checks performed inside the active tunnel.

## License compliance

Keep required third-party notices and license texts in shipped applications and release artifacts. Product screens may use Fokk branding, while required legal notices remain available in the legal/about area.
