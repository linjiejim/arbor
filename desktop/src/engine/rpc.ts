// The app's engine over local HTTP, for the MCP server and the CLI: one
// POST per command. Loopback only, with a random token from ~/.turnery/engine.json.
import { randomBytes, timingSafeEqual } from "node:crypto"
import http from "node:http"
import type { AddressInfo } from "node:net"
import type { CallContext, CommandResult } from "../../../app/src/desktop/core/protocol"

export type CallBody = { command: string; input: unknown; ctx: Omit<CallContext, "actor"> }

const MAX_BODY = 32 * 1024 * 1024

/** `run`: where an agent's call goes (the app has one engine per window and picks one). */
export async function serveEngine(run: (command: string, input: unknown, ctx: CallContext) => Promise<CommandResult>, version: string) {
  const token = randomBytes(24).toString("hex")
  const expected = Buffer.from(`Bearer ${token}`)
  let port = 0
  const server = http.createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
      res.end(JSON.stringify(body))
    }
    // Only this machine's tools, addressed as localhost: no browser page reaches it by DNS tricks.
    const host = req.headers.host ?? ""
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(403, { error: "forbidden host" })
    if (req.url === "/health" && req.method === "GET") return send(200, { name: "turnery", version, pid: process.pid })
    const auth = Buffer.from(req.headers.authorization ?? "")
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) return send(401, { error: "unauthorized" })
    if (req.url !== "/call" || req.method !== "POST") return send(404, { error: "not found" })
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) req.destroy()
      else chunks.push(c)
    })
    req.on("end", async () => {
      let body: CallBody
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as CallBody
      } catch {
        return send(400, { error: "bad json" })
      }
      const { session, cwd, part } = body.ctx ?? {}
      const result = await run(String(body.command), body.input, { actor: "agent", session, cwd, part })
      send(200, result)
    })
  })
  // request_pick can wait a few minutes for the person.
  server.requestTimeout = 0
  server.headersTimeout = 60_000
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  port = (server.address() as AddressInfo).port
  return { port, token, close: () => new Promise<void>((r) => server.close(() => r())) }
}
