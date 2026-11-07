// How to plug Arbor into a coding agent: one command per agent, built around
// the `arbor` executable on this machine.
import type { AgentSetup } from "../../../app/src/desktop/core/protocol"

const quote = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`)

export function agentSetup(bin: string): AgentSetup {
  return {
    bin,
    claude: `claude mcp add --scope user arbor -- ${quote(bin)} mcp`,
    codex: `codex mcp add arbor -- ${quote(bin)} mcp`,
    json: JSON.stringify({ mcpServers: { arbor: { command: bin, args: ["mcp"] } } }, null, 2),
  }
}
