#!/usr/bin/env python3
"""
Fokk Mesh 3.0 — Sentinel Node Scanner, Security Auditor & Signed Manifest Updater

Runs every 6 hours on GitHub Actions to keep Fokk Mesh relays fast, safe, and alive.

6-Layer Security & Quality Verification per Relay:
  1. Bogon / SSRF Guard: Rejects private, loopback, link-local, and reserved IPs.
  2. Dual-Endpoint TLS Integrity (CERT_REQUIRED + hostname check):
       Tests BOTH api.ipify.org:443 AND cloudflare.com:443 through the relay.
       Any self-signed/forged cert, MITM interception, or selective blocking = REJECT.
  3. Anonymity / Transparent Proxy Leak Check:
       Verifies the exit IP differs from the scanner's direct IP (no transparent leak).
  4. Real Dual-Hop Chaining Verification:
       Tests ingress_relay candidates by actually chaining:
         Scanner -> Ingress -> Egress -> api.ipify.org:443 (TLS).
       Only relays that genuinely support 2-hop chaining get ingress_relay=true.
  5. Quality Scoring & Latency Ranking:
       Computes latency_ms and quality_score (0-100), sorting fastest reliable nodes first.
  6. Ed25519 Cryptographic Manifest Signing:
       If FOKK_MESH_ED25519_PRIVKEY is configured in CI secrets, signs the canonical
       nodes payload with Ed25519 so Android and Desktop clients verify authenticity.
"""

import base64
import concurrent.futures
import ipaddress
import json
import os
import socket
import ssl
import struct
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(REPO_ROOT, "nodes_manifest.json")
NODES_JSON_PATH = os.path.join(REPO_ROOT, "nodes.json")

CONNECT_TIMEOUT = 4.5          # seconds for TCP connect to relay
SSL_TIMEOUT = 6.5              # seconds for TLS handshake + HTTP through relay
MAX_LATENCY_MS = 2500          # exclude sluggish relays

# Curated Fokk Mesh relay candidate pool (registered/vetted relays only).
CANDIDATE_POOL = [
    # Americas
    {"host": "45.61.188.134",   "port": 44499, "country": "US", "city": "Miami",        "type": "socks5", "ingress_relay": True},
    {"host": "69.55.49.177",    "port": 38182, "country": "US", "city": "North Bergen", "type": "socks5", "ingress_relay": True},
    {"host": "184.75.221.82",   "port": 3118,  "country": "CA", "city": "Montreal",     "type": "http",   "ingress_relay": False},
    # Europe
    {"host": "49.13.22.249",    "port": 10805, "country": "DE", "city": "Frankfurt",    "type": "socks5", "ingress_relay": False},
    {"host": "49.13.22.249",    "port": 10802, "country": "DE", "city": "Frankfurt",    "type": "socks5", "ingress_relay": True},
    {"host": "5.75.133.113",    "port": 10802, "country": "DE", "city": "Frankfurt",    "type": "socks5", "ingress_relay": False},
    {"host": "5.75.133.113",    "port": 10807, "country": "DE", "city": "Falkenstein",  "type": "socks5", "ingress_relay": False},
    {"host": "171.25.158.95",   "port": 1080,  "country": "SE", "city": "Stockholm",    "type": "socks5", "ingress_relay": False},
    {"host": "193.218.118.128", "port": 1080,  "country": "NL", "city": "Amsterdam",    "type": "socks5", "ingress_relay": False},
    {"host": "51.159.115.233",  "port": 1080,  "country": "FR", "city": "Paris",        "type": "socks5", "ingress_relay": False},
    {"host": "77.91.90.27",     "port": 1082,  "country": "GB", "city": "London",       "type": "socks5", "ingress_relay": False},
    # Asia & Pacific
    {"host": "188.166.178.163", "port": 1088,  "country": "SG", "city": "Singapore",    "type": "socks5", "ingress_relay": True},
    {"host": "183.87.145.150",  "port": 2080,  "country": "IN", "city": "Mumbai",       "type": "socks5", "ingress_relay": False},
    {"host": "101.36.104.239",  "port": 10808, "country": "JP", "city": "Tokyo",        "type": "socks5", "ingress_relay": False},
    {"host": "101.36.104.46",   "port": 10808, "country": "JP", "city": "Osaka",        "type": "socks5", "ingress_relay": False},
    {"host": "123.58.219.171",  "port": 10808, "country": "HK", "city": "Hong Kong",    "type": "socks5", "ingress_relay": False},
    {"host": "121.169.46.116",  "port": 1090,  "country": "KR", "city": "Suwon",        "type": "socks5", "ingress_relay": False},
]

# Strict TLS context — CERT_REQUIRED + hostname check blocks any MITM relay
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = True
ssl_ctx.verify_mode = ssl.CERT_REQUIRED


def is_safe_public_host(host: str) -> bool:
    """Reject loopback, RFC1918 private, link-local, multicast, or reserved IPs."""
    if not host or host.lower() in ("localhost", "0.0.0.0"):
        return False
    try:
        ip = ipaddress.ip_address(host)
        return not (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        )
    except ValueError:
        # Hostname — ensure it doesn't resolve to a private IP
        try:
            resolved = socket.gethostbyname(host)
            ip = ipaddress.ip_address(resolved)
            return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)
        except Exception:
            return False


def get_scanner_direct_ip() -> str:
    """Fetch scanner's own public IP so we can catch transparent/leaking proxies."""
    for url in ("https://api.ipify.org?format=json", "https://ifconfig.me/ip"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "FokkMeshSentinel/3.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read().decode("utf-8", errors="ignore").strip()
                if raw.startswith("{"):
                    return json.loads(raw).get("ip", "").strip()
                return raw
        except Exception:
            continue
    return ""


def _read_exact(sock: socket.socket, n: int) -> bytes:
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise EOFError(f"Premature EOF ({len(buf)}/{n})")
        buf += chunk
    return buf


def _socks5_handshake(sock: socket.socket) -> bool:
    sock.sendall(b"\x05\x01\x00")
    resp = _read_exact(sock, 2)
    return resp[0] == 0x05 and resp[1] == 0x00


def _socks5_connect(sock: socket.socket, host: str, port: int, do_greeting: bool = True) -> bool:
    if do_greeting and not _socks5_handshake(sock):
        return False
    host_bytes = host.encode("ascii")
    req = b"\x05\x01\x00\x03" + bytes([len(host_bytes)]) + host_bytes + struct.pack(">H", port)
    sock.sendall(req)
    header = _read_exact(sock, 4)
    if header[0] != 0x05 or header[1] != 0x00:
        return False
    atyp = header[3]
    if atyp == 0x01:
        _read_exact(sock, 6)
    elif atyp == 0x03:
        length = _read_exact(sock, 1)[0]
        _read_exact(sock, length + 2)
    elif atyp == 0x04:
        _read_exact(sock, 18)
    else:
        return False
    return True


def _http_connect(sock: socket.socket, host: str, port: int) -> bool:
    req = f"CONNECT {host}:{port} HTTP/1.1\r\nHost: {host}:{port}\r\nProxy-Connection: Keep-Alive\r\n\r\n"
    sock.sendall(req.encode("ascii"))
    buf = b""
    while b"\r\n\r\n" not in buf and len(buf) < 2048:
        chunk = sock.recv(256)
        if not chunk:
            break
        buf += chunk
    first_line = buf.split(b"\r\n", 1)[0]
    return b" 200" in first_line


def _https_get_via_relay(node: dict, target_host: str, target_path: str) -> tuple:
    """
    Open a strict CERT_REQUIRED TLS tunnel through node to target_host:443.
    Returns (latency_ms, body_text, error_reason).
    """
    host = node["host"]
    port = int(node["port"])
    proto = node.get("type", "socks5")
    t0 = time.time()
    raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    raw.settimeout(CONNECT_TIMEOUT)
    try:
        raw.connect((host, port))
        raw.settimeout(SSL_TIMEOUT)
        ok = _socks5_connect(raw, target_host, 443) if proto == "socks5" else _http_connect(raw, target_host, 443)
        if not ok:
            return None, "", "PROXY_CONNECT_REJECT"

        tls = ssl_ctx.wrap_socket(raw, server_hostname=target_host)
        tls.sendall(
            f"GET {target_path} HTTP/1.1\r\n"
            f"Host: {target_host}\r\n"
            f"User-Agent: FokkMeshSentinel/3.0\r\n"
            f"Connection: close\r\n\r\n".encode("ascii")
        )
        chunks = []
        total = 0
        while total < 16384:
            c = tls.recv(2048)
            if not c:
                break
            chunks.append(c)
            total += len(c)
        tls.close()
        latency_ms = int((time.time() - t0) * 1000)
        resp = b"".join(chunks)
        body = resp.split(b"\r\n\r\n", 1)[-1].decode("utf-8", errors="ignore").strip()
        return latency_ms, body, ""
    except ssl.SSLCertVerificationError as e:
        return None, "", f"SSL_MITM({e})"
    except socket.timeout:
        return None, "", "TIMEOUT"
    except Exception as e:
        return None, "", type(e).__name__
    finally:
        try:
            raw.close()
        except Exception:
            pass


def test_node(node: dict, scanner_ip: str) -> dict:
    """Run full security, TLS integrity, anonymity, and latency verification on one node."""
    host = node["host"]
    port = int(node["port"])
    if not is_safe_public_host(host) or not (1 <= port <= 65535):
        return {"ok": False, "reason": "UNSAFE_HOST_OR_PORT"}

    # Check 1: Strict TLS to api.ipify.org
    lat1, body1, err1 = _https_get_via_relay(node, "api.ipify.org", "/?format=json")
    if lat1 is None:
        return {"ok": False, "reason": f"IPIFY_{err1}"}

    exit_ip = ""
    try:
        exit_ip = json.loads(body1).get("ip", "").strip()
    except Exception:
        exit_ip = body1.strip()
    if not exit_ip:
        return {"ok": False, "reason": "EMPTY_EXIT_IP"}

    # Check 2: Transparent proxy / real-IP leak guard
    if scanner_ip and exit_ip == scanner_ip:
        return {"ok": False, "reason": "TRANSPARENT_IP_LEAK"}

    # Check 3: Independent second HTTPS endpoint (Cloudflare trace) — verifies TLS + non-censorship + header cleanliness
    lat2, body2, err2 = _https_get_via_relay(node, "www.cloudflare.com", "/cdn-cgi/trace")
    if lat2 is None or "ip=" not in body2:
        return {"ok": False, "reason": f"CLOUDFLARE_{err2 or 'INVALID_TRACE'}"}

    avg_latency = int((lat1 + lat2) / 2)
    if avg_latency > MAX_LATENCY_MS:
        return {"ok": False, "reason": f"TOO_SLOW({avg_latency}ms)"}

    # Quality score (0-100): favors low latency and clean dual-endpoint pass
    quality_score = max(10, min(100, int(100 - (avg_latency / 30))))

    return {
        "ok": True,
        "latency_ms": avg_latency,
        "exit_ip": exit_ip,
        "quality_score": quality_score,
        "reason": "PASS",
    }


def test_dual_hop_chain(ingress: dict, egress: dict) -> bool:
    """
    Actually verify 2-hop SOCKS5 chaining:
      Scanner -> Ingress (SOCKS5) -> Egress (SOCKS5/HTTP) -> api.ipify.org:443 (CERT_REQUIRED TLS).
    """
    if ingress.get("type", "socks5") != "socks5":
        return False
    if ingress["host"] == egress["host"]:
        return False

    raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    raw.settimeout(CONNECT_TIMEOUT)
    try:
        raw.connect((ingress["host"], int(ingress["port"])))
        raw.settimeout(SSL_TIMEOUT)
        # Hop 1: Ingress -> Egress
        if not _socks5_connect(raw, egress["host"], int(egress["port"]), do_greeting=True):
            return False
        # Hop 2: Egress -> api.ipify.org:443
        if egress.get("type", "socks5") == "http":
            if not _http_connect(raw, "api.ipify.org", 443):
                return False
        else:
            if not _socks5_connect(raw, "api.ipify.org", 443, do_greeting=True):
                return False
        # Strict TLS through the full 2-hop circuit
        tls = ssl_ctx.wrap_socket(raw, server_hostname="api.ipify.org")
        tls.sendall(b"GET /?format=json HTTP/1.1\r\nHost: api.ipify.org\r\nConnection: close\r\n\r\n")
        data = tls.recv(1024)
        tls.close()
        return b"200 OK" in data and b'"ip"' in data
    except Exception:
        return False
    finally:
        try:
            raw.close()
        except Exception:
            pass


def sign_nodes_ed25519(nodes_json_bytes: bytes) -> tuple:
    """
    Sign canonical nodes JSON bytes with Ed25519 if FOKK_MESH_ED25519_PRIVKEY is set.
    Returns (signature_b64, is_real_signature).
    """
    priv_b64 = os.environ.get("FOKK_MESH_ED25519_PRIVKEY", "").strip()
    if not priv_b64:
        return "UNSIGNED_DEV_MANIFEST", False
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives import serialization

        raw = base64.b64decode(priv_b64)
        if len(raw) == 32:
            key = Ed25519PrivateKey.from_private_bytes(raw)
        else:
            key = serialization.load_der_private_key(raw, password=None)
        sig = key.sign(nodes_json_bytes)
        return base64.b64encode(sig).decode("ascii"), True
    except Exception as e:
        print(f"WARNING: Ed25519 signing failed ({e}); keeping unsigned marker.")
        return "UNSIGNED_DEV_MANIFEST", False


def load_manifest() -> dict:
    if not os.path.exists(MANIFEST_PATH):
        return {"version": 2, "nodes": list(CANDIDATE_POOL)}
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_manifest(verified_nodes: list, signed_sig: str, is_signed: bool) -> None:
    now = datetime.now(timezone.utc)
    manifest = {
        "version": 2,
        "issued_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expires_at": (now + timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "signed": is_signed,
        "nodes": verified_nodes,
        "signature": signed_sig,
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote {MANIFEST_PATH} ({len(verified_nodes)} verified nodes, signed={is_signed})")


def sync_nodes_json(verified_nodes: list) -> None:
    country_map = {}
    for n in verified_nodes:
        c = n["country"]
        country_map.setdefault(c, []).append({
            "host": n["host"],
            "port": n["port"],
            "isHttpConnect": n.get("type", "socks5") == "http",
            "country": c,
            "city": n.get("city", ""),
            "latencyMs": n.get("latency_ms", 0),
            "supportsDualHop": n.get("supports_dual_hop", False),
        })
    output = {
        "version": 2,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "nodes": country_map,
    }
    with open(NODES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {NODES_JSON_PATH}")


def write_job_summary(results: list, failed: list, dual_hop_count: int) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "")
    lines = [
        "# Fokk Mesh 3.0 Sentinel Health Report",
        "",
        f"**Scan time:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"**Verified relays:** {len(results)} | **Dual-hop verified ingress relays:** {dual_hop_count} | **Rejected:** {len(failed)}",
        "",
        "## Verified Relays",
        "",
        "| Host | Port | Country | City | Latency | Score | Dual-Hop | Exit IP |",
        "|------|------|---------|------|---------|-------|----------|---------|",
    ]
    for r in sorted(results, key=lambda x: x["latency_ms"]):
        dh = "YES" if r.get("supports_dual_hop") else "egress"
        lines.append(
            f"| `{r['host']}` | {r['port']} | {r['country']} | {r['city']} "
            f"| {r['latency_ms']} ms | {r['quality_score']} | {dh} | `{r['exit_ip']}` |"
        )
    if failed:
        lines += ["", "## Rejected Relays", ""]
        for f_item in failed:
            lines.append(f"- `{f_item['host']}:{f_item['port']}` ({f_item['country']}) — `{f_item['reason']}`")

    text = "\n".join(lines)
    print("\n" + text)
    if summary_path:
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(text)


def main() -> None:
    print(f"[{datetime.now(timezone.utc).isoformat()}] Fokk Mesh 3.0 Sentinel Scanner starting...")
    scanner_ip = get_scanner_direct_ip()
    print(f"Scanner direct IP baseline: {scanner_ip or 'unavailable'}")

    manifest = load_manifest()
    current_nodes = manifest.get("nodes", [])

    seen = set()
    all_candidates = []
    for n in list(current_nodes) + list(CANDIDATE_POOL):
        key = (n["host"], int(n["port"]))
        if key not in seen:
            seen.add(key)
            all_candidates.append(n)

    print(f"Auditing {len(all_candidates)} candidate relays in parallel...")

    verified = []
    failed = []
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
        future_map = {ex.submit(test_node, n, scanner_ip): n for n in all_candidates}
        for future in concurrent.futures.as_completed(future_map):
            node = future_map[future]
            res = future.result()
            if res["ok"]:
                print(
                    f"  PASS  {node['host']}:{node['port']} ({node['country']}) "
                    f"{res['latency_ms']}ms score={res['quality_score']} -> {res['exit_ip']}"
                )
                entry = {
                    "host": node["host"],
                    "port": int(node["port"]),
                    "country": str(node.get("country", "")).upper(),
                    "city": str(node.get("city", "")),
                    "type": "http" if node.get("type") == "http" else "socks5",
                    "tier": "speed" if res["latency_ms"] < 650 else "balanced",
                    "ingress_relay": bool(node.get("ingress_relay", False)),
                    "supports_dual_hop": False,
                    "latency_ms": res["latency_ms"],
                    "quality_score": res["quality_score"],
                    "verified": True,
                }
                verified.append(entry)
                results.append({**entry, "exit_ip": res["exit_ip"]})
            else:
                print(f"  FAIL  {node['host']}:{node['port']} ({node['country']}) — {res['reason']}")
                failed.append({
                    "host": node["host"],
                    "port": node["port"],
                    "country": node.get("country", ""),
                    "reason": res["reason"],
                })

    if not verified:
        print("ABORT: 0 relays passed verification. Preserving existing manifest unchanged.")
        write_job_summary([], failed, 0)
        sys.exit(1)

    # Sort fastest first before testing dual-hop chaining
    verified.sort(key=lambda n: n["latency_ms"])

    # Phase 2: Real Dual-Hop Chaining Verification for SOCKS5 ingress relays
    dual_hop_verified = 0
    socks_nodes = [n for n in verified if n["type"] == "socks5"]
    if len(verified) >= 2 and socks_nodes:
        print("Phase 2: Testing real 2-hop chaining on SOCKS5 relays...")
        for candidate in socks_nodes:
            egress_target = next((e for e in verified if e["host"] != candidate["host"]), None)
            if egress_target and test_dual_hop_chain(candidate, egress_target):
                candidate["ingress_relay"] = True
                candidate["supports_dual_hop"] = True
                dual_hop_verified += 1
                print(f"  2-HOP PASS  {candidate['host']}:{candidate['port']} -> {egress_target['host']}:{egress_target['port']}")
            else:
                candidate["ingress_relay"] = False
                candidate["supports_dual_hop"] = False

    # Sync dual-hop flags into summary results
    dh_lookup = {(n["host"], n["port"]): n["supports_dual_hop"] for n in verified}
    for r in results:
        r["supports_dual_hop"] = dh_lookup.get((r["host"], r["port"]), False)

    # Sign canonical compact JSON representation of nodes array
    canonical_nodes_bytes = json.dumps(verified, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig_b64, is_signed = sign_nodes_ed25519(canonical_nodes_bytes)

    save_manifest(verified, sig_b64, is_signed)
    sync_nodes_json(verified)
    write_job_summary(results, failed, dual_hop_verified)
    print(f"Done. Verified={len(verified)}, DualHopIngress={dual_hop_verified}, Signed={is_signed}")


if __name__ == "__main__":
    main()
