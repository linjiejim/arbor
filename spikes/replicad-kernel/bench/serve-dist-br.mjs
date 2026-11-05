// Static server for `dist/` that serves .wasm pre-compressed with brotli (like a CDN would),
// plus COOP/COEP. Used to measure real download time under Chrome network throttling.
// Usage: npx vite build && node bench/serve-dist-br.mjs [port]
import http from "node:http";
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { brotliCompressSync, constants } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const port = Number(process.argv[2] ?? 5197);
for (const f of readdirSync(path.join(root, "assets"))) {
  if (!f.endsWith(".wasm")) continue;
  const p = path.join(root, "assets", f);
  if (!existsSync(p + ".br")) {
    const t = Date.now();
    writeFileSync(p + ".br", brotliCompressSync(readFileSync(p), { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24 } }));
    console.log("compressed", f, Date.now() - t, "ms");
  }
}
const types = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".css": "text/css" };
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = path.join(root, decodeURIComponent(url.pathname));
    if (url.pathname === "/") p = path.join(root, "index.html");
    if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
    const headers = {
      "Content-Type": types[path.extname(p)] ?? "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cache-Control": "no-store",
    };
    if (p.endsWith(".wasm") && /\bbr\b/.test(req.headers["accept-encoding"] ?? "") && existsSync(p + ".br")) {
      headers["Content-Encoding"] = "br";
      res.writeHead(200, headers);
      res.end(readFileSync(p + ".br"));
      return;
    }
    res.writeHead(200, headers);
    res.end(readFileSync(p));
  })
  .listen(port, () => console.log(`serving dist with brotli wasm on http://localhost:${port}/`));
