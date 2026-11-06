// Reference area of a line of text, by the font's own non-zero winding rule:
// scanlines over the outlines (quadratics flattened), independent of the kernel.
import { readFileSync } from "node:fs"
import opentype from "opentype.js"

const buf = readFileSync(new URL("../../studio/fonts/text-sc.ttf", import.meta.url))
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

type Cmd = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }

export function glyphArea(text: string, size: number, step = 0.01): number {
  const polys: [number, number][][] = []
  let cur: [number, number][] = []
  let last: [number, number] = [0, 0]
  for (const c of font.getPath(text, 0, 0, size).commands as Cmd[]) {
    if (c.type === "M") {
      if (cur.length) polys.push(cur)
      cur = [(last = [c.x!, -c.y!])]
    } else if (c.type === "L") cur.push((last = [c.x!, -c.y!]))
    else if (c.type === "Q" || c.type === "C") {
      for (let t = 1; t <= 16; t++) {
        const u = t / 16
        const [cx, cy] = c.type === "Q" ? [c.x1!, -c.y1!] : [(c.x1! + c.x2!) / 2, -(c.y1! + c.y2!) / 2]
        cur.push([(1 - u) ** 2 * last[0] + 2 * (1 - u) * u * cx + u * u * c.x!, (1 - u) ** 2 * last[1] + 2 * (1 - u) * u * cy + u * u * -c.y!])
      }
      last = [c.x!, -c.y!]
    } else if (c.type === "Z") {
      if (cur.length) polys.push(cur)
      cur = []
    }
  }
  if (cur.length) polys.push(cur)
  const ys = polys.flat().map((p) => p[1])
  let area = 0
  for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step) {
    const xs: [number, number][] = []
    for (const p of polys)
      for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i]
        const [x2, y2] = p[(i + 1) % p.length]
        if (y1 <= y !== y2 <= y) xs.push([x1 + ((y - y1) / (y2 - y1)) * (x2 - x1), y2 > y1 ? 1 : -1])
      }
    xs.sort((a, b) => a[0] - b[0])
    let w = 0
    for (let i = 0; i < xs.length - 1; i++) {
      w += xs[i][1]
      if (w !== 0) area += (xs[i + 1][0] - xs[i][0]) * step
    }
  }
  return area
}
