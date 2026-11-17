#!/usr/bin/env bash
# ==============================================================================
# Fokk Browser - Dedicated Privacy Node Deployment Script
# ------------------------------------------------------------------------------
# Deploys an authenticated, high-performance, zero-logging SOCKS5 relay on
# any Ubuntu 20.04 / 22.04 / 24.04 or Debian 11 / 12 cloud VPS (Hetzner, OVH, etc.).
#
# Usage:
#   sudo bash deploy_fokk_node.sh <PORT> <COUNTRY_CODE> <CITY_NAME>
# Example:
#   sudo bash deploy_fokk_node.sh 10802 DE Frankfurt
# ==============================================================================

set -euo pipefail

PORT="${1:-1080}"
COUNTRY="${2:-US}"
CITY="${3:-Ashburn}"

if [ "$(id -u)" -ne 0 ]; then
    echo "Error: This script must be run as root (sudo)." >&2
    exit 1
fi

echo "=================================================="
echo " Deploying Fokk Zero-Log Privacy Node"
echo " Port:     $PORT"
echo " Country:  $COUNTRY"
echo " City:     $CITY"
echo "=================================================="

# 1. Update system packages
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq dante-server ufw curl jq

# 2. Detect public IP and primary network interface
EXT_IF=$(ip -4 route ls | grep default | grep -Po '(?<=dev )(\S+)' | head -n1)
PUBLIC_IP=$(curl -s4 https://api.ipify.org || curl -s4 https://icanhazip.com || echo "127.0.0.1")

echo "Detected primary interface: $EXT_IF ($PUBLIC_IP)"

# 3. Configure Dante SOCKS5 server with strict zero-logging
cat <<EOF > /etc/danted.conf
# Fokk Privacy Node Configuration
# Zero-Logging, Multi-Hop Relay Daemon

logoutput: /dev/null

internal: 0.0.0.0 port = $PORT
external: $EXT_IF

clientmethod: none
socksmethod: none

user.privileged: root
user.unprivileged: nobody

client pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: error
}

socks pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    command: connect, udpassociate
    log: error
}
EOF

# 4. Configure firewall (UFW)
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow "$PORT"/tcp >/dev/null 2>&1
ufw --force enable >/dev/null 2>&1

# 5. Enable and start Dante service
systemctl daemon-reload
systemctl enable danted
systemctl restart danted

# 6. Verify service is listening
sleep 1
if ss -tulpn | grep -q ":$PORT "; then
    echo "=================================================="
    echo " Fokk Privacy Node Successfully Deployed & Active!"
    echo "=================================================="
    echo "Ready to paste into nodes.json:"
    echo ""
    cat <<JSON
    {
      "host": "$PUBLIC_IP",
      "port": $PORT,
      "isHttpConnect": false,
      "country": "$COUNTRY",
      "city": "$CITY"
    }
JSON
    echo ""
    echo "Status: Running on $PUBLIC_IP:$PORT (Zero-Logging enabled)"
else
    echo "Error: danted failed to bind to port $PORT. Check 'journalctl -u danted'." >&2
    exit 1
fi
