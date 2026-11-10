// `turnery mcp`: the MCP server a coding agent starts over stdio. It lists the
// engine's agent commands as tools and forwards every call to the running
// Turnery app (starting it if needed), so the person watches each step.
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { AGENT_GUIDE, agentCommands, inputJsonSchema } from "../../../app/src/desktop/core/catalog"
import { Link } from "../engine/backend"

declare const __TURNERY_VERSION__: string

export async function runMcp(distDir: URL) {
  // TURNERY_HEADLESS: start the app without windows; TURNERY_NO_APP: an engine in this process only (no look, no picks).
  const noApp = process.env.TURNERY_NO_APP === "1"
  const hidden = process.env.TURNERY_HEADLESS === "1"
  const link = new Link({ noApp, hidden, launch: !noApp && process.env.TURNERY_NO_LAUNCH !== "1", fallback: true, distDir, log: (m) => process.stderr.write(`[turnery] ${m}\n`) })
  const tools = agentCommands().map((c) => ({ name: c.name, description: c.description, inputSchema: inputJsonSchema(c) as { type: "object" } }))

  const server = new Server({ name: "turnery", title: "Turnery", version: __TURNERY_VERSION__ }, { capabilities: { tools: {} }, instructions: AGENT_GUIDE })
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params
    try {
      const res = await link.call(name, args ?? {}, { cwd: process.cwd() })
      const content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[] = [{ type: "text", text: res.text }]
      for (const img of res.images ?? []) content.push({ type: "image", data: img.replace(/^data:image\/png;base64,/, ""), mimeType: "image/png" })
      if ((await link.kind) === "local" && (name === "look" || name === "request_pick")) content.push({ type: "text", text: "（Turnery App 没有运行：现在是无窗口模式。）" })
      return { content, isError: !res.ok }
    } catch (e) {
      return { content: [{ type: "text", text: `✗ ${(e as Error).message}` }], isError: true }
    }
  })

  const transport = new StdioServerTransport()
  const quit = async () => {
    await link.close().catch(() => {})
    process.exit(0)
  }
  transport.onclose = () => void quit()
  process.stdin.on("end", () => void quit())
  await server.connect(transport)
}
