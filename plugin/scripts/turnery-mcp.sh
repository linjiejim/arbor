#!/bin/sh
# Starts the MCP server that ships inside Turnery.app. stdout is the protocol channel: messages go to stderr.
for bin in "$TURNERY_BIN" \
  "/Applications/Turnery.app/Contents/Resources/bin/turnery" \
  "$HOME/Applications/Turnery.app/Contents/Resources/bin/turnery"; do
  if [ -n "$bin" ] && [ -x "$bin" ]; then exec "$bin" mcp "$@"; fi
done
if command -v turnery >/dev/null 2>&1; then exec turnery mcp "$@"; fi
echo "Turnery.app was not found. Install it from https://github.com/linjiejim/turnery/releases/latest, open it once, then reconnect the turnery server (/mcp). Set TURNERY_BIN if it lives somewhere else." >&2
exit 1
