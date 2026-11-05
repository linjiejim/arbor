// Write .br and .gz next to every compressible file in dist/, so Caddy can
// serve them as-is (`file_server { precompressed br gzip }`) instead of
// compressing the 23 MB OpenCascade wasm on every request.
// Results are cached by content hash, so only changed files cost time.
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const DIST = "dist"
const CACHE = "node_modules/.cache/precompress"
const EXT = /\.(js|mjs|css|html|json|svg|wasm|glb|txt|xml)$/
const MIN = 1024

fs.mkdirSync(CACHE, { recursive: true })

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (EXT.test(e.name)) yield p
  }
}

let n = 0
let saved = 0
const t0 = Date.now()
for (const file of walk(DIST)) {
  const buf = fs.readFileSync(file)
  if (buf.length < MIN) continue
  const key = path.join(CACHE, crypto.createHash("sha1").update(buf).digest("hex"))
  // Max effort where it pays (the 23 MB wasm, fetched by every studio visitor); quick for bulky model files.
  const quality = file.endsWith(".wasm") ? 11 : file.endsWith(".glb") ? 5 : 9
  let br
  if (fs.existsSync(`${key}.br`)) br = fs.readFileSync(`${key}.br`)
  else {
    br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: quality, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } })
    fs.writeFileSync(`${key}.br`, br)
  }
  const gz = zlib.gzipSync(buf, { level: 9 })
  if (br.length < buf.length * 0.9) fs.writeFileSync(`${file}.br`, br)
  if (gz.length < buf.length * 0.9) fs.writeFileSync(`${file}.gz`, gz)
  n++
  saved += buf.length - Math.min(br.length, buf.length)
}
console.log(`precompress: ${n} files, brotli saves ${(saved / 1048576).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
