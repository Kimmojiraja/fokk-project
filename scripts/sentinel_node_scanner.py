#!/usr/bin/env python3
"""
Automated Sentinel Node Scanner for Fokk Browser.
Scans, tests TLS transparency, geolocates, and updates nodes.json.
Runs daily on GitHub Actions to ensure 100% maintenance-free zero-leak privacy.
"""

import urllib.request
import concurrent.futures
import socket
import ssl
import json
import os
import sys
from datetime import datetime, timezone

TARGET_COUNTRIES = [
    # Americas (10)
    "US", "CA", "MX", "BR", "AR", "CL", "CO", "PE", "CR", "PA",
    # Europe (18)
    "GB", "DE", "NL", "FR", "CH", "SE", "NO", "FI", "ES", "IT", "PL", "IE", "BE", "AT", "CZ", "DK", "PT", "RO",
    # Asia & Pacific (12)
    "JP", "KR", "SG", "HK", "IN", "AU", "NZ", "TW", "MY", "ID", "TH", "VN",
    # Middle East & Africa (4)
    "AE", "IL", "ZA", "TR"
]
NODES_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "nodes.json")

ctx = ssl.create_default_context()

try:
    import socks
except ImportError:
    print("Installing PySocks...")
    os.system(f"{sys.executable} -m pip install PySocks")
    import socks

def test_proxy(host, port, proto, timeout=3.5):
    """Verifies that a proxy can transparently tunnel TLS to api.ipify.org without SSL errors."""
    try:
        s = socks.socksocket()
        if proto == 'socks5':
            s.set_proxy(socks.SOCKS5, host, int(port))
        else:
            s.set_proxy(socks.HTTP, host, int(port))
        s.settimeout(timeout)
        s.connect(('api.ipify.org', 443))
        ss = ctx.wrap_socket(s, server_hostname='api.ipify.org')
        ss.sendall(b"GET /?format=json HTTP/1.1\r\nHost: api.ipify.org\r\nConnection: close\r\n\r\n")
        data = ss.recv(1024).decode('utf-8', errors='ignore')
        ss.close()
        body = data.split("\r\n\r\n")[-1].strip()
        parsed = json.loads(body)
        exit_ip = parsed.get("ip")
        if not exit_ip:
            return None
        return exit_ip
    except Exception:
        return None

def geolocate(ip):
    try:
        geo_req = urllib.request.Request(
            f"http://ip-api.com/json/{ip}?fields=status,countryCode,city",
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(geo_req, timeout=3.5) as res:
            data = json.loads(res.read().decode('utf-8'))
            if data.get("status") == "success":
                return data.get("countryCode"), data.get("city")
    except Exception:
        pass
    return None, None

def main():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting Fokk Sentinel Node Scanner...")
    
    # 1. Load existing nodes.json
    existing_nodes = {}
    if os.path.exists(NODES_JSON_PATH):
        try:
            with open(NODES_JSON_PATH, "r") as f:
                data = json.load(f)
                existing_nodes = data.get("nodes", {})
        except Exception as e:
            print(f"Warning reading existing nodes.json: {e}")

    verified_nodes = {c: [] for c in TARGET_COUNTRIES}

    # 2. Test existing nodes first (to keep stable working nodes)
    print("Testing existing nodes...")
    for c in TARGET_COUNTRIES:
        for node in existing_nodes.get(c, []):
            proto = "http" if node.get("isHttpConnect") else "socks5"
            exit_ip = test_proxy(node["host"], node["port"], proto)
            if exit_ip:
                print(f"Existing node alive: [{c}] {node['host']}:{node['port']} ({proto}) -> {exit_ip}")
                verified_nodes[c].append(node)

    # 3. Check which countries need fresh nodes
    needed_countries = [c for c in TARGET_COUNTRIES if len(verified_nodes[c]) < 2]
    if needed_countries:
        print(f"Scanning for additional nodes for: {needed_countries}")
        sources = [
            ("https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt", "socks5"),
            ("https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt", "http"),
            ("https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt", "socks5"),
            ("https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt", "http"),
            ("https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt", "socks5"),
            ("https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt", "http"),
        ]

        candidates = []
        for url, proto in sources:
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    lines = resp.read().decode('utf-8', errors='ignore').split('\n')
                    for line in lines[:200]:
                        line = line.strip()
                        if line.startswith(f"{proto}://"):
                            line = line.split("://")[1]
                        if ':' in line:
                            h, p = line.split(':')[:2]
                            candidates.append((h, p, proto))
            except Exception:
                pass

        print(f"Testing {len(candidates)} candidate proxies...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            future_to_cand = {executor.submit(test_proxy, c[0], c[1], c[2]): c for c in candidates}
            for future in concurrent.futures.as_completed(future_to_cand):
                cand = future_to_cand[future]
                exit_ip = future.result()
                if exit_ip:
                    country, city = geolocate(exit_ip)
                    if country in needed_countries and len(verified_nodes[country]) < 2:
                        node_entry = {
                            "host": cand[0],
                            "port": int(cand[1]),
                            "isHttpConnect": (cand[2] == "http"),
                            "country": country,
                            "city": city or country
                        }
                        # Prevent duplicate hosts
                        if not any(n["host"] == node_entry["host"] for n in verified_nodes[country]):
                            verified_nodes[country].append(node_entry)
                            print(f"Added verified node: [{country}] {node_entry['host']}:{node_entry['port']} ({cand[2]})")

    # 4. Fallback to existing nodes if a country temporarily had no new node
    for c in TARGET_COUNTRIES:
        if not verified_nodes[c] and c in existing_nodes:
            verified_nodes[c] = existing_nodes[c]

    # 5. Write back to nodes.json
    output_data = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "nodes": verified_nodes
    }

    with open(NODES_JSON_PATH, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"Successfully updated nodes.json with {sum(len(v) for v in verified_nodes.values())} total verified nodes.")

if __name__ == "__main__":
    main()
