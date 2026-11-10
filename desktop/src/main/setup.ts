// How to plug Turnery into a coding agent: one command per agent, built around
// the `turnery` executable on this machine.
import type { AgentSetup } from "../../../app/src/desktop/core/protocol"

const quote = (s: string) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`)

export function agentSetup(bin: string): AgentSetup {
  return {
    bin,
    claude: `claude mcp add --scope user turnery -- ${quote(bin)} mcp`,
    codex: `codex mcp add turnery -- ${quote(bin)} mcp`,
    json: JSON.stringify({ mcpServers: { turnery: { command: bin, args: ["mcp"] } } }, null, 2),
  }
}
