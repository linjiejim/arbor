#!/bin/sh
# The arbor command inside Arbor.app (MCP server: `arbor mcp`), run with the
# Node that ships in Electron. Works through a symlink, e.g.
#   ln -s /Applications/Arbor.app/Contents/Resources/bin/arbor /usr/local/bin/arbor
SELF="$(readlink -f "$0" 2>/dev/null || echo "$0")"
CONTENTS="$(cd "$(dirname "$SELF")/../.." && pwd)"
ARBOR_BIN="$SELF" ELECTRON_RUN_AS_NODE=1 exec "$CONTENTS/MacOS/Arbor" "$CONTENTS/Resources/app/dist/cli.mjs" "$@"
