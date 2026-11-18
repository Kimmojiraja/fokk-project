#!/usr/bin/env python3
"""
Fokk Mesh 2.0 — Sentinel Node Scanner & Manifest Updater

Runs nightly on GitHub Actions.

What this does:
  1. Loads the current nodes_manifest.json
  2. Tests every node with a full SSL tunnel verification:
       TCP connect -> SOCKS5/HTTP CONNECT -> TLS handshake to api.ipify.org:443
       with CERT_REQUIRED and hostname verification.
       If the cert is self-signed or forged the test FAILS and the node is removed.
  3. Measures round-trip latency per node.
  4. Removes dead or MITM-intercepting nodes.
  5. Attempts to find replacement nodes ONLY from the curated candidate pool
     (no random scraped proxy lists — legal and trust compliance).
  6. Writes back nodes_manifest.json and keeps nodes.json in sync.
  7. Outputs a GitHub Actions job summary with node health report.

Legal compliance:
  Replacement candidates must be explicitly registered Fokk relay servers.
  The candidate pool below contains only servers whose operators have
  either (a) been contacted and confirmed consent, or (b) are running
  well-known public SOCKS5 services on dedicated privacy relay ports.
  Random open-proxy scraped lists are NOT used.
"""

import concurrent.futures
import json
import os
import socket
import ssl
import struct
import time
import sys
from datetime import datetime, timezone

MANIFEST_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "nodes_manifest.json"
)
NODES_JSON_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "nodes.json"
)

CONNECT_TIMEOUT = 4.0   # seconds for TCP connect to relay
SSL_TIMEOUT     = 6.0   # seconds for SSL handshake through relay
MIN_LATENCY_THRESHOLD = 2500  # ms — nodes slower than this are excluded

# ---------------------------------------------------------------------------
# Curated replacement candidate pool.
# These are ONLY servers that have been manually verified as:
#   (a) Legitimate SOCKS5 relay infrastructure
#   (b) Not intercepting TLS (confirmed via SSL cert check)
#   (c) Not scraped from random open-proxy lists
# New nodes can be added here after manual verification.
# ---------------------------------------------------------------------------
CANDIDATE_POOL = [
    # US
    {"host": "45.61.188.134",   "port": 44499, "country": "US", "city": "Miami",        "type": "socks5", "ingress_relay": True},
    {"host": "69.55.49.177",    "port": 38182, "country": "US", "city": "North Bergen", "type": "socks5", "ingress_relay": True},
    # CA
    {"host": "184.75.221.82",   "port": 3118,  "country": "CA", "city": "Montreal",     "type": "http",   "ingress_relay": False},
    # DE
    {"host": "49.13.22.249",    "port": 10805, "country": "DE", "city": "Frankfurt",    "type": "socks5", "ingress_relay": False},
    {"host": "49.13.22.249",    "port": 10802, "country": "DE", "city": "Frankfurt",    "type": "socks5", "ingress_relay": True},
    {"host": "5.75.133.113",    "port": 10802, "country": "DE", "city": "Frankfurt",    "type": "socks5", "ingress_relay": False},
    {"host": "5.75.133.113",    "port": 10807, "country": "DE", "city": "Falkenstein",  "type": "socks5", "ingress_relay": False},
    # SE
    {"host": "171.25.158.95",   "port": 1080,  "country": "SE", "city": "Stockholm",    "type": "socks5", "ingress_relay": False},
    # NL
    {"host": "193.218.118.128", "port": 1080,  "country": "NL", "city": "Amsterdam",    "type": "socks5", "ingress_relay": False},
    # FR
    {"host": "51.159.115.233",  "port": 1080,  "country": "FR", "city": "Paris",        "type": "socks5", "ingress_relay": False},
    # GB
    {"host": "77.91.90.27",     "port": 1082,  "country": "GB", "city": "London",       "type": "socks5", "ingress_relay": False},
    # SG
    {"host": "188.166.178.163", "port": 1088,  "country": "SG", "city": "Singapore",    "type": "socks5", "ingress_relay": True},
    # IN
    {"host": "183.87.145.150",  "port": 2080,  "country": "IN", "city": "Mumbai",       "type": "socks5", "ingress_relay": False},
    # JP
    {"host": "101.36.104.239",  "port": 10808, "country": "JP", "city": "Tokyo",        "type": "socks5", "ingress_relay": False},
    {"host": "101.36.104.46",   "port": 10808, "country": "JP", "city": "Osaka",        "type": "socks5", "ingress_relay": False},
    # HK
    {"host": "123.58.219.171",  "port": 10808, "country": "HK", "city": "Hong Kong",    "type": "socks5", "ingress_relay": False},
    # KR
    {"host": "121.169.46.116",  "port": 1090,  "country": "KR", "city": "Suwon",        "type": "socks5", "ingress_relay": False},
]

# SSL context — CERT_REQUIRED + hostname check ensures no MITM can pass
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = True
ssl_ctx.verify_mode = ssl.CERT_REQUIRED


def _socks5_connect(sock, host, port):
    """Send SOCKS5 greeting and CONNECT command. Returns True on success."""
    sock.sendall(b"\x05\x01\x00")
    resp = sock.recv(2)
    if len(resp) < 2 or resp[0] != 0x05 or resp[1] != 0x00:
        return False
    host_bytes = host.encode("ascii")
    req = (
        b"\x05\x01\x00\x03"
        + bytes([len(host_bytes)])
        + host_bytes
        + struct.pack(">H", port)
    )
    sock.sendall(req)
    # Read 4-byte header
    header = b""
    while len(header) < 4:
        chunk = sock.recv(4 - len(header))
        if not chunk:
            return False
        header += chunk
    if header[0] != 0x05 or header[1] != 0x00:
        return False
    atyp = header[3]
    if atyp == 0x01:
        sock.recv(6)
    elif atyp == 0x03:
        n = sock.recv(1)[0]
        sock.recv(n + 2)
    elif atyp == 0x04:
        sock.recv(18)
    return True


def _http_connect(sock, host, port):
    """Send HTTP CONNECT command. Returns True on 200 response."""
    req = f"CONNECT {host}:{port} HTTP/1.1\r\nHost: {host}:{port}\r\nProxy-Connection: Keep-Alive\r\n\r\n"
    sock.sendall(req.encode("ascii"))
    buf = b""
    while b"\r\n\r\n" not in buf and len(buf) < 1024:
        chunk = sock.recv(256)
        if not chunk:
            break
        buf += chunk
    return b" 200 " in buf or buf.startswith(b"HTTP/1.1 200") or buf.startswith(b"HTTP/1.0 200")


def test_node(node):
    """
    Full SSL verification through the relay node.
    Returns (latency_ms, exit_ip) on success, or (None, None) on failure.
    """
    host = node["host"]
    port = node["port"]
    proto = node.get("type", "socks5")
    t0 = time.time()
    raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    raw.settimeout(CONNECT_TIMEOUT)
    try:
        raw.connect((host, port))
        raw.settimeout(SSL_TIMEOUT)

        if proto == "socks5":
            ok = _socks5_connect(raw, "api.ipify.org", 443)
        else:
            ok = _http_connect(raw, "api.ipify.org", 443)

        if not ok:
            raw.close()
            return None, None

        # TLS handshake — CERT_REQUIRED ensures no MITM can pass
        tls = ssl_ctx.wrap_socket(raw, server_hostname="api.ipify.org")
        tls.sendall(
            b"GET /?format=json HTTP/1.1\r\n"
            b"Host: api.ipify.org\r\n"
            b"Connection: close\r\n\r\n"
        )
        resp = b""
        while True:
            chunk = tls.recv(1024)
            if not chunk:
                break
            resp += chunk
        tls.close()

        latency_ms = int((time.time() - t0) * 1000)
        body = resp.split(b"\r\n\r\n", 1)[-1].strip()
        try:
            parsed = json.loads(body)
            exit_ip = parsed.get("ip", "")
        except Exception:
            exit_ip = body.decode("ascii", errors="ignore").strip()

        if not exit_ip:
            return None, None
        return latency_ms, exit_ip

    except ssl.SSLCertVerificationError as e:
        print(f"  MITM/SSL FAIL {host}:{port} — cert error: {e}")
        return None, None
    except Exception:
        return None, None
    finally:
        try:
            raw.close()
        except Exception:
            pass


def load_manifest():
    if not os.path.exists(MANIFEST_PATH):
        return {"version": 1, "nodes": list(CANDIDATE_POOL)}
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def save_manifest(manifest):
    manifest["issued_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest["expires_at_hint"] = "24h"
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote {MANIFEST_PATH}")


def sync_nodes_json(verified_nodes):
    """Keep nodes.json in sync for backward compatibility with older app versions."""
    country_map = {}
    for n in verified_nodes:
        c = n["country"]
        country_map.setdefault(c, []).append({
            "host": n["host"],
            "port": n["port"],
            "isHttpConnect": n.get("type", "socks5") == "http",
            "country": c,
            "city": n.get("city", "")
        })
    output = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "nodes": country_map
    }
    with open(NODES_JSON_PATH, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {NODES_JSON_PATH}")


def write_job_summary(results, removed, added):
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "")
    lines = [
        "# Fokk Mesh Node Health Report",
        "",
        f"**Scan time:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Verified Nodes",
        "",
        "| Host | Port | Country | City | Latency | Exit IP |",
        "|------|------|---------|------|---------|---------|",
    ]
    for r in sorted(results, key=lambda x: x["latency_ms"]):
        lines.append(
            f"| `{r['host']}` | {r['port']} | {r['country']} | {r['city']} "
            f"| {r['latency_ms']} ms | `{r['exit_ip']}` |"
        )
    if removed:
        lines += ["", "## Removed Nodes (failed SSL verification)", ""]
        for n in removed:
            lines.append(f"- `{n['host']}:{n['port']}` ({n['country']}) — dead or MITM")
    if added:
        lines += ["", "## Added Replacement Nodes", ""]
        for n in added:
            lines.append(f"- `{n['host']}:{n['port']}` ({n['country']}, {n.get('city','')})")

    summary_text = "\n".join(lines)
    print("\n" + summary_text)
    if summary_path:
        with open(summary_path, "w") as f:
            f.write(summary_text)


def main():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Fokk Mesh 2.0 Sentinel Scanner starting...")

    manifest = load_manifest()
    current_nodes = manifest.get("nodes", [])

    # Build the full candidate pool: manifest nodes + any in CANDIDATE_POOL not already present
    manifest_keys = {(n["host"], n["port"]) for n in current_nodes}
    all_candidates = list(current_nodes)
    for c in CANDIDATE_POOL:
        if (c["host"], c["port"]) not in manifest_keys:
            all_candidates.append(c)
            print(f"  Candidate from pool: {c['host']}:{c['port']} ({c['country']})")

    print(f"Testing {len(all_candidates)} nodes in parallel...")

    verified = []
    removed = []
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as ex:
        future_map = {ex.submit(test_node, n): n for n in all_candidates}
        for future in concurrent.futures.as_completed(future_map):
            node = future_map[future]
            try:
                latency_ms, exit_ip = future.result()
            except Exception:
                latency_ms, exit_ip = None, None

            if latency_ms is not None and latency_ms < MIN_LATENCY_THRESHOLD:
                print(f"  PASS  {node['host']}:{node['port']} ({node['country']}) {latency_ms}ms -> {exit_ip}")
                entry = dict(node)
                entry["verified"] = True
                verified.append(entry)
                results.append({
                    "host": node["host"], "port": node["port"],
                    "country": node["country"], "city": node.get("city",""),
                    "latency_ms": latency_ms, "exit_ip": exit_ip
                })
            else:
                reason = f"{latency_ms}ms" if latency_ms else "dead/MITM"
                print(f"  FAIL  {node['host']}:{node['port']} ({node['country']}) — {reason}")
                # Only add to 'removed' if it was previously in the manifest
                if (node["host"], node["port"]) in manifest_keys:
                    removed.append(node)

    # Determine what was newly added (passed test but wasn't in manifest before)
    added = [
        n for n in verified
        if (n["host"], n["port"]) not in manifest_keys
    ]

    # Warn if node count is critically low
    total = len(verified)
    print(f"\nResult: {total} nodes verified, {len(removed)} removed, {len(added)} added.")
    if total < 5:
        print("WARNING: Verified node count is critically low (<5). Manual intervention needed.")
        # Don't write an empty manifest — keep existing if we have almost nothing
        if total == 0:
            print("ABORT: No verified nodes. Keeping existing manifest unchanged.")
            sys.exit(1)

    # Sort by latency (fastest first)
    verified.sort(key=lambda n: results[next(
        i for i, r in enumerate(results)
        if r["host"] == n["host"] and r["port"] == n["port"]
    )]["latency_ms"] if any(
        r["host"] == n["host"] and r["port"] == n["port"] for r in results
    ) else 9999)

    manifest["nodes"] = verified
    save_manifest(manifest)
    sync_nodes_json(verified)
    write_job_summary(results, removed, added)
    print("Done.")


if __name__ == "__main__":
    main()
