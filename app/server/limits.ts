import fs from "node:fs"
import path from "node:path"

/** Sliding-window counter per key (IP). In memory: a restart forgives everyone. */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  private limit: number
  private windowMs: number
  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  /** Records a hit; returns seconds to wait, or 0 if allowed. */
  take(key: string, now = Date.now()): number {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs)
    if (list.length >= this.limit) {
      this.hits.set(key, list)
      return Math.ceil((this.windowMs - (now - list[0])) / 1000)
    }
    list.push(now)
    this.hits.set(key, list)
    if (this.hits.size > 10000) this.sweep(now)
    return 0
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k)
  }
}

/** DeepSeek list prices per 1M tokens (USD), peak / off-peak. https://api-docs.deepseek.com/quick_start/pricing */
const PRICE = {
  "deepseek-flash": { hit: [0.006, 0.003], miss: [0.3, 0.15], out: [1.2, 0.6] },
  "deepseek-v4-pro": { hit: [0.044, 0.022], miss: [1.32, 0.66], out: [3.96, 1.98] },
} as const

/** Peak = 01–04 and 06–10 UTC on weekdays (Chinese public holidays are off-peak; ignored here, which only over-counts). */
export function isPeak(d = new Date()) {
  const day = d.getUTCDay()
  const h = d.getUTCHours()
  return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10))
}

export type Usage = { inputTokens?: number; cacheReadTokens?: number; outputTokens?: number }

export function costUSD(model: string, u: Usage, at = new Date()) {
  const p = PRICE[model as keyof typeof PRICE] ?? PRICE["deepseek-v4-pro"]
  const k = isPeak(at) ? 0 : 1
  const hit = u.cacheReadTokens ?? 0
  const miss = Math.max(0, (u.inputTokens ?? 0) - hit)
  return (hit * p.hit[k] + miss * p.miss[k] + (u.outputTokens ?? 0) * p.out[k]) / 1e6
}

/** Daily spend on the hosted key, persisted so a restart doesn't reset it. Day boundary: Asia/Shanghai. */
export class Budget {
  private day = ""
  private spent = 0
  private file: string
  private dailyUSD: number

  constructor(dir: string, dailyUSD: number) {
    this.dailyUSD = dailyUSD
    fs.mkdirSync(dir, { recursive: true })
    this.file = path.join(dir, "budget.json")
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, "utf8"))
      if (saved.day === today()) Object.assign(this, { day: saved.day, spent: saved.spent })
    } catch {
      /* first run */
    }
  }

  private roll() {
    const d = today()
    if (d !== this.day) Object.assign(this, { day: d, spent: 0 })
  }

  exhausted() {
    this.roll()
    return this.spent >= this.dailyUSD
  }

  add(usd: number) {
    this.roll()
    this.spent += usd
    fs.writeFile(this.file, JSON.stringify({ day: this.day, spent: this.spent }), () => {})
  }

  status() {
    this.roll()
    return { day: this.day, spentUSD: Math.round(this.spent * 1000) / 1000, limitUSD: this.dailyUSD }
  }
}

const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
