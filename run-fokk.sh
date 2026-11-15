#!/usr/bin/env bash
# Fokk Browser Local Desktop Launcher
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/desktop/node_modules/.bin/electron" ]; then
    exec "$SCRIPT_DIR/desktop/node_modules/.bin/electron" "$SCRIPT_DIR/desktop" --no-sandbox "$@"
elif [ -f "$SCRIPT_DIR/desktop/dist/linux-unpacked/fokk-browser" ]; then
    exec "$SCRIPT_DIR/desktop/dist/linux-unpacked/fokk-browser" --no-sandbox "$@"
else
    cd "$SCRIPT_DIR/desktop" && npm start -- --no-sandbox "$@"
fi
