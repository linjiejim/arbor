import { describe, expect, it } from "vitest"
import { keyEnvOf, languageModel, PRESETS, presetOf } from "@/desktop/core/providers"

describe("turnery: model presets", () => {
  it("names a key variable per preset and knows every preset by id", () => {
    expect(keyEnvOf("deepseek")).toBe("TURNERY_API_KEY_DEEPSEEK")
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
    for (const p of PRESETS) expect(presetOf(p.id)).toBe(p)
    // Everything but Anthropic and DeepSeek's own client speaks the OpenAI format and needs an address (custom: the person's).
    for (const p of PRESETS) if (p.kind === "openai-compatible" && p.id !== "custom") expect(p.baseURL, p.id).toMatch(/^https?:\/\//)
  })

  it("says what is missing instead of making a model that cannot work", () => {
    expect(languageModel({ preset: "nope" }, "k")).toMatchObject({ error: expect.stringContaining("没有这个预设") })
    expect(languageModel({ preset: "deepseek" }, null)).toMatchObject({ error: expect.stringContaining("TURNERY_API_KEY_DEEPSEEK") })
    expect(languageModel({ preset: "openai" }, "k")).toMatchObject({ error: expect.stringContaining("模型名") })
    expect(languageModel({ preset: "custom", model: "m" }, "k")).toMatchObject({ error: expect.stringContaining("地址") })
  })

  it("resolves a model, with vision only where it is known or the person says so", () => {
    const ds = languageModel({ preset: "deepseek" }, "k")
    expect(ds).toMatchObject({ vision: false, label: "DeepSeek · deepseek-flash" })
    expect("providerOptions" in ds && ds.providerOptions).toBeTruthy()
    expect(languageModel({ preset: "anthropic" }, "k")).toMatchObject({ vision: true })
    // Another model name on the same preset: not assumed to see.
    expect(languageModel({ preset: "anthropic", model: "something-else" }, "k")).toMatchObject({ vision: false })
    expect(languageModel({ preset: "ollama", model: "qwen", vision: true }, null)).toMatchObject({ vision: true, label: "Ollama（本机） · qwen" })
  })
})
