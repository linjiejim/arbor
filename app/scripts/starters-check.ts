import { STARTERS } from "../src/studio/starters"
import { Kernel } from "../src/studio/kernel/build"
import { initNodeKernel } from "../src/studio/kernel/node"
await initNodeKernel()
for (const s of STARTERS) {
  const k = new Kernel()
  const r = k.rebuild(s.tree)
  console.log(s.id, r.features.map((f) => `${f.id}:${f.state}${f.message ? `(${f.message})` : ""}`).join(" "), r.body?.size, r.body?.solids)
  k.dispose()
}
