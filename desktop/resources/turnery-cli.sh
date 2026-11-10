#!/bin/sh
# The turnery command inside Turnery.app (MCP server: `turnery mcp`), run with the
# Node that ships in Electron. Works through a symlink, e.g.
#   ln -s /Applications/Turnery.app/Contents/Resources/bin/turnery /usr/local/bin/turnery
SELF="$(readlink -f "$0" 2>/dev/null || echo "$0")"
CONTENTS="$(cd "$(dirname "$SELF")/../.." && pwd)"
TURNERY_BIN="$SELF" ELECTRON_RUN_AS_NODE=1 exec "$CONTENTS/MacOS/Turnery" "$CONTENTS/Resources/app/dist/cli.mjs" "$@"
