import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { expect, it } from "vitest"
import { ThreadKernel } from "../../../../desktop/src/engine/kernel-host"
import type { Tree } from "@/studio/dsl"
import type { BuildReport } from "@/studio/kernel/build"

// Exercise the actual worker routing/lifecycle without loading a second OCCT
// build in the unit suite. The independent checker deliberately stays busy.
it("keeps interaction responsive during checks, remaps hashes, rejects stale results and reports worker failures", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "arbor-background-"))
  const file = path.join(dir, "worker.mjs")
  await writeFile(file, `
    import { parentPort as p } from 'node:worker_threads';
    p.postMessage({type:'ready'});
    p.on('message', async ({id,op,args}) => {
      let result = null;
      if (op === 'use') result = true;
      if (op === 'pick') result = {hash: args[1]};
      if (op === 'rebuild') {
        const [tree, options] = args;
        const fast = !!options?.deferChecks;
        const hash = fast ? 10 : 20;
        p.postMessage({type:'preview',display:{index:0,mesh:null,groups:[{hash,start:0,count:3,origin:'a',status:'new'}],edges:null,edgeGroups:[{hash:hash+1,start:0,count:2}],sketch:null,bbox:null,threads:[]}});
        if (!fast) {
          await new Promise(r=>setTimeout(r,300));
          if (tree.params.fail) {p.postMessage({id,ok:false,error:'diagnostic failed'});return;}
        }
        result = {params:tree.params,features:[],lastOk:0,body:null,ms:0,checksPending:fast||undefined,checks:fast?undefined:[{id:'c',faces:[hash],edges:[hash+1]}]};
      }
      p.postMessage({id,ok:true,result,heapMB:1});
    });
  `)
  const reports: BuildReport[] = []
  let receive: ((r: BuildReport) => void) | undefined
  const kernel = new ThreadKernel(pathToFileURL(file), undefined, undefined, (_slot, r) => { reports.push(r); receive?.(r) })
  const tree: Tree = { params: {}, features: [{ id: "a", op: "component", file: "part" }] }
  const nextReport = () => new Promise<BuildReport>((resolve) => { receive = resolve })
  try {
    await kernel.use("assembly")
    const next = nextReport()
    expect((await kernel.rebuild(tree, { background: true })).checksPending).toBe(true)
    expect(await kernel.pick("face", 10, [0, 0, 0])).toEqual({ hash: 10 })
    expect(reports).toHaveLength(0)
    const checked = await next
    expect(checked.checksPending).toBeUndefined()
    expect(checked.checks?.[0]).toMatchObject({ faces: [10], edges: [11] })
    const latest = nextReport()
    await kernel.rebuild({ ...tree, params: { revision: 1 } }, { background: true })
    await kernel.rebuild({ ...tree, params: { revision: 2 } }, { background: true })
    expect((await latest).params.revision).toBe(2)
    expect(reports).toHaveLength(2)
    const failed = nextReport()
    await kernel.rebuild({ ...tree, params: { fail: 1 } }, { background: true })
    expect(await failed).toMatchObject({ checksPending: false, checksError: "diagnostic failed" })
    expect(await kernel.pick("face", 10, [0, 0, 0])).toEqual({ hash: 10 })
  } finally {
    await kernel.dispose()
    await rm(dir, { recursive: true, force: true })
  }
}, 10_000)
