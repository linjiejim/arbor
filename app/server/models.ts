// Which model answers, and what a call cost. Shared by the API server and the
// eval script so both talk to the model the same way.
//
// Two routes:
//   DeepSeek direct — a learner's own key (x-deepseek-key), or DEEPSEEK_API_KEY.
//   OpenRouter      — OPENROUTER_API_KEY; takes precedence for the hosted quota.
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel, ProviderMetadata } from "ai"
import { costUSD, type Usage } from "./limits"

export type Thinking = "enabled" | "disabled"

export type ModelRoute = {
  model: LanguageModel
  /** Shown in the studio header and logged with usage. */
  label: string
  via: "deepseek" | "openrouter"
  providerOptions?: Record<string, Record<string, never>>
  /** Dollars for one call: the provider's own figure when it reports one. */
  cost: (usage: Usage, meta: ProviderMetadata | undefined) => number
}

export function deepseekRoute(apiKey: string, model: string, thinking: Thinking, baseURL?: string): ModelRoute {
  const deepseek = createDeepSeek({ apiKey, baseURL })
  return {
    model: deepseek(model),
    label: model,
    via: "deepseek",
    providerOptions: { deepseek: { thinking: { type: thinking }, ...(thinking === "enabled" ? { reasoningEffort: "low" } : {}) } as never },
    cost: (usage) => costUSD(model, usage),
  }
}

/**
 * OpenRouter serves the same weights from many hosts. Routing stays on fp8 or
 * better (several hosts run fp4), cheapest first; the account's data policy
 * decides which hosts are allowed at all. Sticking to the cheapest host also
 * keeps the prompt cache warm between steps.
 */
export const OPENROUTER_MODEL = "deepseek/deepseek-v4.1-flash-1017"

export const OPENROUTER_ROUTING = { quantizations: ["fp8", "fp16", "bf16"], sort: "price" }

/** `routing` is OpenRouter's `provider` object; OPENROUTER_ROUTING (JSON) overrides it on the server. */
export function openrouterRoute(apiKey: string, model: string, thinking: Thinking, routing: object = OPENROUTER_ROUTING): ModelRoute {
  const openrouter = createOpenRouter({ apiKey, headers: { "HTTP-Referer": "https://featuretree.linjiejim.com", "X-Title": "FeatureTree" } })
  return {
    model: openrouter.chat(model, {
      provider: routing as never,
      reasoning: thinking === "enabled" ? { effort: "low" } : { effort: "none" },
      usage: { include: true },
    }),
    label: model.replace(/^[^/]+\//, ""),
    via: "openrouter",
    cost: (usage, meta) => {
      const reported = (meta?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
      return typeof reported === "number" ? reported : costUSD("deepseek-flash", usage)
    },
  }
}

/** The hosted route from the environment, or null when the site has no key. */
export function hostedRoute(env: NodeJS.ProcessEnv, thinking: Thinking): ModelRoute | null {
  if (env.OPENROUTER_API_KEY)
    return openrouterRoute(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL ?? OPENROUTER_MODEL, thinking, env.OPENROUTER_ROUTING ? JSON.parse(env.OPENROUTER_ROUTING) : undefined)
  if (env.DEEPSEEK_API_KEY) return deepseekRoute(env.DEEPSEEK_API_KEY, env.STUDIO_MODEL ?? "deepseek-flash", thinking, env.DEEPSEEK_BASE_URL)
  return null
}
