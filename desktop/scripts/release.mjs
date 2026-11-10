// Release files from the .app bundles electron-builder left in release/ (run after
// `electron-builder --mac dir`), into release/upload/:
//   Turnery-<version>-<arch>.dmg        to download and drag into Applications
//   Turnery-<version>-mac-<arch>.zip    what installed copies download to update themselves
//   turnery-update.json                 the update manifest, signed (only with a key, see below)
// Each bundle is signed ad hoc first (no Apple certificate): a consistent signature means a
// browser-downloaded copy is "from an unidentified developer" rather than "damaged".
//
// The update key: env TURNERY_UPDATE_KEY (the PEM itself, as in CI) or --key <file>. Without one
// only the dmg and zip are made. The manifest is checked against the public key built into the
// app before it's written, so a wrong key fails here and not on every installed copy.
//
//   node scripts/release.mjs [--key ~/.arbor-release/update-key.pem] [--base-url <url>]
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync, mkdirSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assetFor, parseManifest, signAsset } from "../src/update/manifest.ts"
import { UPDATE_PUBLIC_KEY } from "../src/update/public-key.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))
const version = pkg.version
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const keyFile = arg("--key")
const key = process.env.TURNERY_UPDATE_KEY || (keyFile ? readFileSync(keyFile.replace(/^~(?=\/)/, os.homedir()), "utf8") : null)
const baseUrl = arg("--base-url") ?? `https://github.com/linjiejim/turnery/releases/download/turnery-v${version}`

const out = path.join(root, "release/upload")
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"], ...opts })

// electron-builder's folders: mac-arm64/ for Apple silicon, mac/ for Intel.
const builds = [
  { arch: "arm64", dir: "mac-arm64" },
  { arch: "x64", dir: "mac" },
].filter((b) => existsSync(path.join(root, "release", b.dir, "Turnery.app")))
if (!builds.length) throw new Error("release/ 里没有 Turnery.app：先运行 electron-builder --mac dir")

const platforms = {}
for (const { arch, dir } of builds) {
  const app = path.join(root, "release", dir, "Turnery.app")
  const plistVersion = execFileSync("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", path.join(app, "Contents/Info.plist")]).toString().trim()
  if (plistVersion !== version) throw new Error(`${dir}/Turnery.app 是 ${plistVersion}，package.json 是 ${version}：重新打包`)

  sh("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", app])
  sh("/usr/bin/codesign", ["--verify", "--deep", "--strict", app])

  const zip = path.join(out, `Turnery-${version}-mac-${arch}.zip`)
  sh("/usr/bin/ditto", ["-c", "-k", "--keepParent", app, zip])

  const stage = mkdtempSync(path.join(os.tmpdir(), "turnery-dmg-"))
  sh("/usr/bin/ditto", [app, path.join(stage, "Turnery.app")])
  symlinkSync("/Applications", path.join(stage, "Applications"))
  sh("/usr/bin/hdiutil", ["create", "-volname", `Turnery ${version}`, "-srcfolder", stage, "-ov", "-format", "UDZO", path.join(out, `Turnery-${version}-${arch}.dmg`)])
  rmSync(stage, { recursive: true, force: true })

  if (key) {
    const bytes = readFileSync(zip)
    const asset = { sha256: createHash("sha256").update(bytes).digest("hex"), size: statSync(zip).size }
    const platform = `darwin-${arch}`
    platforms[platform] = { url: `${baseUrl}/${path.basename(zip)}`, ...asset, signature: signAsset(version, platform, asset, key) }
  }
}

if (key) {
  const manifest = parseManifest({ version, pub_date: new Date().toISOString(), platforms })
  for (const platform of Object.keys(platforms)) assetFor(manifest, platform, UPDATE_PUBLIC_KEY)
  writeFileSync(path.join(out, "turnery-update.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`turnery-update.json: ${version} for ${Object.keys(platforms).join(", ")}, signed and checked against the built-in key`)
} else {
  console.log("no update key: made the dmg and zip only, no turnery-update.json")
}
sh("/bin/ls", ["-la", out])
