// node --test src/update/   (Node 22.18+ runs the TypeScript directly)
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash, generateKeyPairSync } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { BUNDLE_ID, bundleOf, cannotReplace, download, stagingDir, swapBundles, unpack } from "./install.ts"
import { assetFor, compareVersions, parseManifest, signAsset, type UpdateManifest } from "./manifest.ts"
import { UPDATE_PUBLIC_KEY } from "./public-key.ts"

const keys = generateKeyPairSync("ed25519")
const priv = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString()
const pub = keys.publicKey.export({ type: "spki", format: "pem" }).toString()

const tmp = mkdtempSync(path.join(os.tmpdir(), "turnery-update-test-"))
after(() => rmSync(tmp, { recursive: true, force: true }))

function manifestFor(version: string, bytes: Buffer, platform = "darwin-arm64", key = priv): UpdateManifest {
  const asset = { url: "https://example.invalid/Turnery.zip", sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length }
  return { version, platforms: { [platform]: { ...asset, signature: signAsset(version, platform, asset, key) } } }
}

describe("versions", () => {
  it("compares x.y.z numerically", () => {
    assert.equal(compareVersions("0.10.0", "0.9.9"), 1)
    assert.equal(compareVersions("1.0.0", "1.0.0"), 0)
    assert.equal(compareVersions("0.1.0", "0.2.0"), -1)
    assert.throws(() => compareVersions("0.2.0-beta", "0.1.0"))
  })
})

describe("manifest", () => {
  const bytes = Buffer.from("an archive")
  it("accepts an archive signed for this version and platform", () => {
    const m = parseManifest(JSON.parse(JSON.stringify(manifestFor("0.2.0", bytes))))
    assert.equal(assetFor(m, "darwin-arm64", pub).size, bytes.length)
  })
  it("rejects a signature moved to another version, platform or key", () => {
    const m = manifestFor("0.2.0", bytes)
    assert.throws(() => assetFor({ ...m, version: "0.3.0" }, "darwin-arm64", pub), /签名不对/)
    assert.throws(() => assetFor({ ...m, platforms: { "darwin-x64": m.platforms["darwin-arm64"] } }, "darwin-x64", pub), /签名不对/)
    assert.throws(() => assetFor(m, "darwin-arm64", UPDATE_PUBLIC_KEY), /签名不对/)
    assert.throws(() => assetFor(m, "darwin-x64", pub), /没有 darwin-x64/)
  })
  it("rejects a malformed manifest", () => {
    assert.throws(() => parseManifest({ version: "latest", platforms: {} }), /版本号/)
    assert.throws(() => parseManifest({ version: "0.2.0", platforms: { a: { url: "file:///x", sha256: "0".repeat(64), size: 1, signature: "s" } } }), /地址/)
  })
  it("the built-in key is an ed25519 public key", () => {
    assert.match(UPDATE_PUBLIC_KEY, /^-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA/)
  })
})

describe("download", () => {
  const bytes = Buffer.alloc(200_000, 7)
  const asset = manifestFor("0.2.0", bytes).platforms["darwin-arm64"]
  const serve = (body: Buffer) => async () => new Response(new Blob([new Uint8Array(body)]).stream())

  it("streams to disk and checks size and hash", async () => {
    const file = path.join(tmp, "dl", "ok.zip")
    let seen = 0
    await download(serve(bytes), asset, file, (b) => (seen = b))
    assert.equal(seen, bytes.length)
    assert.deepEqual(readFileSync(file), bytes)
  })
  it("refuses a tampered or wrong-sized archive", async () => {
    const bad = Buffer.from(bytes)
    bad[10] = 0
    await assert.rejects(download(serve(bad), asset, path.join(tmp, "dl", "bad.zip")), /SHA-256/)
    await assert.rejects(download(serve(bytes.subarray(1)), asset, path.join(tmp, "dl", "short.zip")), /大小不对/)
    await assert.rejects(download(serve(Buffer.concat([bytes, bytes])), asset, path.join(tmp, "dl", "long.zip")), /大/)
  })
  it("reports HTTP errors", async () => {
    await assert.rejects(download(async () => new Response("no", { status: 404 }), asset, path.join(tmp, "dl", "404.zip")), /HTTP 404/)
  })
})

/** A fake Turnery.app: Info.plist, an executable, and a symlink like the frameworks have. */
function fakeApp(dir: string, version: string, id = BUNDLE_ID) {
  const app = path.join(dir, "Turnery.app")
  mkdirSync(path.join(app, "Contents/MacOS"), { recursive: true })
  const plist = path.join(app, "Contents/Info.plist")
  execFileSync("/usr/bin/plutil", ["-create", "xml1", plist])
  execFileSync("/usr/bin/plutil", ["-insert", "CFBundleIdentifier", "-string", id, plist])
  execFileSync("/usr/bin/plutil", ["-insert", "CFBundleShortVersionString", "-string", version, plist])
  writeFileSync(path.join(app, "Contents/MacOS/Turnery"), `#!/bin/sh\necho ${version}\n`, { mode: 0o755 })
  symlinkSync("MacOS/Turnery", path.join(app, "Contents/Current"))
  return app
}

const mac = process.platform === "darwin"

describe("install", { skip: !mac && "macOS only" }, () => {
  it("finds the bundle around the executable", () => {
    assert.equal(bundleOf("/Applications/Turnery.app/Contents/MacOS/Turnery"), "/Applications/Turnery.app")
    assert.equal(bundleOf("/usr/local/bin/electron"), null)
  })
  it("refuses to update from a disk image", () => {
    assert.match(cannotReplace("/Volumes/Turnery/Turnery.app") ?? "", /拖进「应用程序」/)
    assert.match(cannotReplace(null) ?? "", /打包好/)
  })

  it("unpacks a zipped bundle, checks it, and swaps it in", async () => {
    const apps = path.join(tmp, "Applications")
    mkdirSync(apps)
    const installed = fakeApp(apps, "0.1.0")
    assert.equal(cannotReplace(installed), null)

    const src = path.join(tmp, "src")
    fakeApp(src, "0.2.0")
    const zip = path.join(tmp, "Turnery-0.2.0.zip")
    execFileSync("/usr/bin/ditto", ["-c", "-k", "--keepParent", path.join(src, "Turnery.app"), zip])

    await assert.rejects(unpack(zip, path.join(stagingDir(installed), "new"), "0.3.0"), /是 0.2.0/)
    const fresh = await unpack(zip, path.join(stagingDir(installed), "new"), "0.2.0")
    swapBundles(installed, fresh)
    assert.equal(execFileSync(path.join(installed, "Contents/MacOS/Turnery")).toString().trim(), "0.2.0")
    assert.equal(execFileSync(path.join(installed, "Contents/Current")).toString().trim(), "0.2.0")
    assert.ok(!existsSync(fresh))
  })

  it("refuses a bundle that isn't Turnery", async () => {
    const src = path.join(tmp, "other")
    fakeApp(src, "0.2.0", "com.example.other")
    const zip = path.join(tmp, "other.zip")
    execFileSync("/usr/bin/ditto", ["-c", "-k", "--keepParent", path.join(src, "Turnery.app"), zip])
    await assert.rejects(unpack(zip, path.join(tmp, "other-out"), "0.2.0"), /不是 Turnery/)
  })

  it("puts the old bundle back when the new one can't be moved in", () => {
    const apps = path.join(tmp, "Apps2")
    mkdirSync(apps)
    const installed = fakeApp(apps, "0.1.0")
    mkdirSync(stagingDir(installed))
    assert.throws(() => swapBundles(installed, path.join(stagingDir(installed), "missing.app")))
    assert.equal(execFileSync(path.join(installed, "Contents/MacOS/Turnery")).toString().trim(), "0.1.0")
  })
})
