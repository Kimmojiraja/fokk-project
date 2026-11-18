#!/usr/bin/env bash
# ==============================================================================
# Fokk Mesh 3.0 — Hardened Dedicated Privacy Relay Deployment Script
# ------------------------------------------------------------------------------
# Deploys a zero-logging, SSRF-hardened, spam-protected Dante SOCKS5 relay on
# Ubuntu 20.04 / 22.04 / 24.04 or Debian 11 / 12 VPS (Hetzner, OVH, DO, etc.).
#
# Security Hardening:
#   - Zero disk logging (logoutput: /dev/null)
#   - Strict RFC1918 / Loopback / Cloud-Metadata (169.254.169.254) egress blocks
#   - SMTP spam port blocks (25, 465, 587) to prevent IP blacklisting
#   - TCP connect only (no UDP open-amplification relay)
#   - UFW connection rate-limiting + optional username/password authentication
#
# Usage:
#   sudo bash deploy_fokk_node.sh <PORT> <COUNTRY_CODE> <CITY_NAME>
# Optional Auth:
#   sudo FOKK_RELAY_USER=fokk FOKK_RELAY_PASS=secret bash deploy_fokk_node.sh 10802 DE Frankfurt
# ==============================================================================

set -euo pipefail

PORT="${1:-10802}"
COUNTRY="${2:-DE}"
CITY="${3:-Frankfurt}"
RELAY_USER="${FOKK_RELAY_USER:-}"
RELAY_PASS="${FOKK_RELAY_PASS:-}"

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root (sudo)." >&2
    exit 1
fi

echo "=================================================="
echo " Deploying Hardened Fokk Mesh 3.0 Relay Node"
echo " Port:     $PORT"
echo " Country:  $COUNTRY"
echo " City:     $CITY"
echo "=================================================="

export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq dante-server ufw curl jq

EXT_IF=$(ip -4 route ls | grep default | grep -Po '(?<=dev )(\S+)' | head -n1)
PUBLIC_IP=$(curl -s4 https://api.ipify.org || curl -s4 https://icanhazip.com || echo "127.0.0.1")

echo "Detected primary interface: $EXT_IF ($PUBLIC_IP)"

AUTH_METHOD="none"
if [ -n "$RELAY_USER" ] && [ -n "$RELAY_PASS" ]; then
    id -u "$RELAY_USER" >/dev/null 2>&1 || useradd --shell /usr/sbin/nologin --no-create-home "$RELAY_USER"
    echo "${RELAY_USER}:${RELAY_PASS}" | chpasswd
    AUTH_METHOD="username"
    echo "Enabled username authentication for relay user: $RELAY_USER"
fi

cat <<EOF > /etc/danted.conf
# Fokk Mesh 3.0 Hardened Zero-Log Relay Configuration
logoutput: /dev/null

internal: 0.0.0.0 port = $PORT
external: $EXT_IF

clientmethod: none
socksmethod: $AUTH_METHOD

user.privileged: root
user.unprivileged: nobody

# Block SSRF to loopback, RFC1918 LAN, link-local, and cloud metadata (AWS/GCP/Azure)
socks block {
    from: 0.0.0.0/0 to: 127.0.0.0/8
    log: error
}
socks block {
    from: 0.0.0.0/0 to: 10.0.0.0/8
    log: error
}
socks block {
    from: 0.0.0.0/0 to: 172.16.0.0/12
    log: error
}
socks block {
    from: 0.0.0.0/0 to: 192.168.0.0/16
    log: error
}
socks block {
    from: 0.0.0.0/0 to: 169.254.0.0/16
    log: error
}
socks block {
    from: 0.0.0.0/0 to: 100.64.0.0/10
    log: error
}

# Block outbound SMTP spam ports to protect VPS reputation
socks block {
    from: 0.0.0.0/0 to: 0.0.0.0/0 port = 25
    log: error
}
socks block {
    from: 0.0.0.0/0 to: 0.0.0.0/0 port = 465
    log: error
}
socks block {
    from: 0.0.0.0/0 to: 0.0.0.0/0 port = 587
    log: error
}

client pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: error
}

# Allow TCP connect only (no open UDP amplification)
socks pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    command: connect
    log: error
}
EOF

ufw allow 22/tcp >/dev/null 2>&1 || true
ufw limit "$PORT"/tcp >/dev/null 2>&1 || ufw allow "$PORT"/tcp >/dev/null 2>&1
ufw --force enable >/dev/null 2>&1

systemctl daemon-reload
systemctl enable danted
systemctl restart danted

sleep 1
if ss -tulpn | grep -q ":$PORT "; then
    echo "=================================================="
    echo " Hardened Fokk Mesh 3.0 Relay Active!"
    echo "=================================================="
    cat <<JSON
    {
      "host": "$PUBLIC_IP",
      "port": $PORT,
      "country": "$COUNTRY",
      "city": "$CITY",
      "type": "socks5",
      "ingress_relay": true,
      "verified": true
    }
JSON
else
    echo "Error: danted failed to bind to port $PORT. Check 'journalctl -u danted'." >&2
    exit 1
fi
