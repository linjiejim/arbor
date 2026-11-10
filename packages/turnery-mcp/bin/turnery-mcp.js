#!/usr/bin/env node
// Finds the Turnery desktop app and hands this process's stdio to its MCP server.
// stdout is the protocol channel: anything for a person goes to stderr.
const { spawn } = require("node:child_process")
const { existsSync } = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const candidates = [
  process.env.TURNERY_BIN,
  "/Applications/Turnery.app/Contents/Resources/bin/turnery",
  path.join(os.homedir(), "Applications/Turnery.app/Contents/Resources/bin/turnery"),
].filter(Boolean)
const bin = candidates.find((p) => existsSync(p))
if (!bin) {
  process.stderr.write(
    "Turnery.app was not found. Install it from https://github.com/linjiejim/turnery/releases/latest and open it once. Set TURNERY_BIN if it lives somewhere else.\n",
  )
  process.exit(1)
}
const child = spawn(bin, ["mcp", ...process.argv.slice(2)], { stdio: "inherit" })
child.on("error", (err) => {
  process.stderr.write(`Could not start ${bin}: ${err.message}\n`)
  process.exit(1)
})
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill(s))
