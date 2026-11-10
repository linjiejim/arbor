// The update manifest (`turnery-update.json`, one per GitHub release) and its signatures.
// Each platform's archive is signed with Turnery's own ed25519 key: the signature covers the
// version, the platform and the archive's SHA-256 and size, so an installed copy only accepts
// an archive made for that version. The public half is built into the app (public-key.ts);
// the private half is the repository secret TURNERY_UPDATE_KEY and never leaves the release job.
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto"

export type UpdateAsset = {
  /** Where the archive (a zip of Turnery.app) is downloaded from. */
  url: string
  sha256: string
  size: number
  /** base64 ed25519 signature of `statement(version, platform, asset)`. */
  signature: string
}

export type UpdateManifest = {
  version: string
  pub_date?: string
  notes?: string
  /** Keyed by `darwin-arm64`, `darwin-x64`. */
  platforms: Record<string, UpdateAsset>
}

/** The platform key of this machine, e.g. `darwin-arm64`. */
export const platformKey = (platform: string = process.platform, arch: string = process.arch) => `${platform}-${arch}`

/** What a signature covers. Changing it means every installed copy rejects the new releases. */
export function statement(version: string, platform: string, asset: Pick<UpdateAsset, "sha256" | "size">) {
  return `turnery-update\n${version}\n${platform}\n${asset.sha256}\n${asset.size}\n`
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/

/** -1, 0 or 1. Plain `x.y.z` only: anything else throws (releases never use pre-release tags). */
export function compareVersions(a: string, b: string) {
  const pa = VERSION.exec(a)
  const pb = VERSION.exec(b)
  if (!pa || !pb) throw new Error(`版本号不是 x.y.z：${pa ? b : a}`)
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i])
    if (d) return d < 0 ? -1 : 1
  }
  return 0
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

/** Checks the shape; throws an Error saying what is wrong. Signatures are checked by `assetFor`. */
export function parseManifest(json: unknown): UpdateManifest {
  if (!isObject(json)) throw new Error("更新清单不是 JSON 对象")
  const { version, platforms, pub_date, notes } = json
  if (typeof version !== "string" || !VERSION.test(version)) throw new Error("更新清单里的版本号不对")
  if (!isObject(platforms)) throw new Error("更新清单里没有 platforms")
  const out: Record<string, UpdateAsset> = {}
  for (const [key, a] of Object.entries(platforms)) {
    if (!isObject(a)) throw new Error(`更新清单里 ${key} 不对`)
    const { url, sha256, size, signature } = a
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) throw new Error(`更新清单里 ${key} 的地址不对`)
    if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`更新清单里 ${key} 的 sha256 不对`)
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) throw new Error(`更新清单里 ${key} 的大小不对`)
    if (typeof signature !== "string" || !signature) throw new Error(`更新清单里 ${key} 没有签名`)
    out[key] = { url, sha256, size, signature }
  }
  return {
    version,
    platforms: out,
    ...(typeof pub_date === "string" ? { pub_date } : {}),
    ...(typeof notes === "string" ? { notes } : {}),
  }
}

/** This platform's archive, once its signature checks out against `publicKeyPem`. */
export function assetFor(manifest: UpdateManifest, platform: string, publicKeyPem: string): UpdateAsset {
  const asset = manifest.platforms[platform]
  if (!asset) throw new Error(`${manifest.version} 没有 ${platform} 的更新包`)
  const ok = verify(null, Buffer.from(statement(manifest.version, platform, asset)), createPublicKey(publicKeyPem), Buffer.from(asset.signature, "base64"))
  if (!ok) throw new Error(`${manifest.version} 的 ${platform} 更新包签名不对`)
  return asset
}

/** For the release job: sign one platform's archive. */
export function signAsset(version: string, platform: string, asset: Pick<UpdateAsset, "sha256" | "size">, privateKeyPem: string) {
  return sign(null, Buffer.from(statement(version, platform, asset)), createPrivateKey(privateKeyPem)).toString("base64")
}
