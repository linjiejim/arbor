// Streaming Markdown: re-parse only the block still being written, and patch it up meanwhile.

/**
 * Split at blank lines into top-level blocks, so a streaming reply re-parses
 * only its last block. Not inside a code fence, and not before an indented
 * line (that continues a list item).
 */
export function splitBlocks(text: string): string[] {
  const lines = text.split("\n")
  const blocks: string[] = []
  let cur: string[] = []
  let fence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    const next = lines[i + 1]
    if (!fence && line.trim() === "" && cur.length && next !== undefined && next.trim() !== "" && !/^\s/.test(next)) {
      blocks.push(cur.join("\n"))
      cur = []
      continue
    }
    cur.push(line)
  }
  if (cur.length) blocks.push(cur.join("\n"))
  return blocks
}

/** A block cut off mid-stream: close the bold, inline code or fence it opened, so it doesn't flash raw markers. */
export function closeOpen(block: string): string {
  const fences = (block.match(/^\s*(```|~~~)/gm) ?? []).length
  if (fences % 2) return `${block}\n\`\`\``
  let out = block
  if (((out.match(/`/g) ?? []).length) % 2) out += "`"
  if (((out.match(/\*\*/g) ?? []).length) % 2) out += "**"
  return out
}
