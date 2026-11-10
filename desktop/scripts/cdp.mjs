// Development helper: look at and poke the Turnery window through the Chrome
// DevTools Protocol. Start the app with `npm start -- --remote-debugging-port=9223`.
//
//   node scripts/cdp.mjs shot out.png        screenshot of the window's page
//   node scripts/cdp.mjs js "<expression>"   evaluate in the page, print the result
//   node scripts/cdp.mjs click <x> <y>       click at CSS pixels
//   node scripts/cdp.mjs hover <x> <y>       move the pointer there (CSS pixels)
//   node scripts/cdp.mjs drag <x> <y> <x2> <y2>  press, move in steps, let go (CSS pixels)
//   node scripts/cdp.mjs type "<text>"       type into the focused field
//   node scripts/cdp.mjs logs                console messages from now for 3 seconds
//   node scripts/cdp.mjs windows             list the windows (one per project)
// With several windows, TURNERY_CDP_WINDOW=<n> (from `windows`) picks one; the first by default.
const port = Number(process.env.TURNERY_CDP_PORT ?? 9223)
const [cmd, arg] = process.argv.slice(2)

const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const windows = pages.filter((p) => p.type === "page" && /desktop\.html/.test(p.url))
if (cmd === "windows") {
  windows.forEach((p, i) => console.log(i, p.title))
  process.exit(0)
}
const page = windows[Number(process.env.TURNERY_CDP_WINDOW ?? 0)]
if (!page) throw new Error(`no Turnery window on port ${port}: ${pages.map((p) => p.url).join(", ")}`)

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
  await writeFile(arg ?? "turnery-window.png", Buffer.from(data, "base64"))
  console.log(arg ?? "turnery-window.png")
} else if (cmd === "js") {
  const res = await send("Runtime.evaluate", { expression: arg, awaitPromise: true, returnByValue: true })
  console.log(JSON.stringify(res.result?.value ?? res.exceptionDetails ?? res.result, null, 2))
} else if (cmd === "click") {
  // `click <x> <y>` in CSS pixels of the window.
  const [x, y] = [Number(arg), Number(process.argv[4])]
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, buttons: type === "mousePressed" ? 1 : 0 })
  console.log(`clicked ${x},${y}`)
} else if (cmd === "hover") {
  // `hover <x> <y>`: move the pointer there without pressing (what opens an ⓘ).
  const [x, y] = [Number(arg), Number(process.argv[4])]
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
  console.log(`hovering ${x},${y}`)
} else if (cmd === "drag") {
  // `drag <x> <y> <x2> <y2>`: a held-down move, in ten steps (what moves or sizes a panel).
  const [x, y, x2, y2] = [arg, ...process.argv.slice(4, 7)].map(Number)
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 })
  for (let i = 1; i <= 10; i++) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + ((x2 - x) * i) / 10, y: y + ((y2 - y) * i) / 10, button: "left", buttons: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x2, y: y2, button: "left", clickCount: 1, buttons: 0 })
  console.log(`dragged ${x},${y} → ${x2},${y2}`)
} else if (cmd === "type") {
  await send("Input.insertText", { text: arg })
  console.log("typed")
} else if (cmd === "logs") {
  await send("Runtime.enable")
  await new Promise((r) => setTimeout(r, 3000))
  for (const e of events.filter((e) => e.method === "Runtime.consoleAPICalled")) console.log(e.params.type, ...e.params.args.map((a) => a.value ?? a.description))
} else {
  console.log("usage: cdp.mjs shot <file> | js <expression> | click <x> <y> | hover <x> <y> | drag <x> <y> <x2> <y2> | type <text> | logs")
}
ws.close()
