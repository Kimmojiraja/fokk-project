#!/usr/bin/env bash
# Fokk Browser Local Desktop Launcher
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/desktop/dist/linux-unpacked/fokk-browser" --no-sandbox "$@"
