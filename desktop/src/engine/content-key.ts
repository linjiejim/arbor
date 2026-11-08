import { createHash } from "node:crypto"

/** Drop only a ComponentSource's derived native payload, never user params or notes. */
export function contentKey(inputs: unknown) {
  const json = JSON.stringify(inputs, function (key, value) {
    if (key === "compiled" && typeof this?.file === "string" && value && typeof value === "object" && Array.isArray(value.parts) && Number.isInteger(value.failed)) return undefined
    return value
  })
  return createHash("sha256").update(json).digest("hex")
}
