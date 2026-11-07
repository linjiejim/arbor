// Development helper: look at and poke the Arbor window through the Chrome
// DevTools Protocol. Start the app with `npm start -- --remote-debugging-port=9223`.
//
//   node scripts/cdp.mjs shot out.png        screenshot of the window's page
//   node scripts/cdp.mjs js "<expression>"   evaluate in the page, print the result
//   node scripts/cdp.mjs click <x> <y>       click at CSS pixels
//   node scripts/cdp.mjs type "<text>"       type into the focused field
//   node scripts/cdp.mjs logs                console messages from now for 3 seconds
const port = Number(process.env.ARBOR_CDP_PORT ?? 9223)
const [cmd, arg] = process.argv.slice(2)

const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const page = pages.find((p) => p.type === "page" && /desktop\.html/.test(p.url))
if (!page) throw new Error(`no Arbor window on port ${port}: ${pages.map((p) => p.url).join(", ")}`)

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => {
  ws.onopen = r
  ws.onerror = j
})
let seq = 0
const waiting = new Map()
const events = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg)
    waiting.delete(msg.id)
  } else if (msg.method) events.push(msg)
}
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    waiting.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })

if (cmd === "shot") {
  const { data } = await send("Page.captureScreenshot", { format: "png" })
  const { writeFile } = await import("node:fs/promises")
  await writeFile(arg ?? "arbor-window.png", Buffer.from(data, "base64"))
  console.log(arg ?? "arbor-window.png")
} else if (cmd === "js") {
  const res = await send("Runtime.evaluate", { expression: arg, awaitPromise: true, returnByValue: true })
  console.log(JSON.stringify(res.result?.value ?? res.exceptionDetails ?? res.result, null, 2))
} else if (cmd === "click") {
  // `click <x> <y>` in CSS pixels of the window.
  const [x, y] = [Number(arg), Number(process.argv[4])]
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, buttons: type === "mousePressed" ? 1 : 0 })
  console.log(`clicked ${x},${y}`)
} else if (cmd === "type") {
  await send("Input.insertText", { text: arg })
  console.log("typed")
} else if (cmd === "logs") {
  await send("Runtime.enable")
  await new Promise((r) => setTimeout(r, 3000))
  for (const e of events.filter((e) => e.method === "Runtime.consoleAPICalled")) console.log(e.params.type, ...e.params.args.map((a) => a.value ?? a.description))
} else {
  console.log("usage: cdp.mjs shot <file> | js <expression> | click <x> <y> | type <text> | logs")
}
ws.close()
