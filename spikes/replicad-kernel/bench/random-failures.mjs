// Which random slider combinations fail, and why? node bench/random-failures.mjs
import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";
import { buildMugSteps, disposeBuild, handleGeometry } from "../src/kernel/mug.js";
import { PARAM_RANGES } from "../src/kernel/params.js";
setOC(await opencascade());
let seed = 12345;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const N = Number(process.argv[2] ?? 40);
const seamAtBack = process.argv[3] !== "front";
console.log('seamAtBack', seamAtBack);
let fails = 0, filletLeWall = 0, shellFailOther = 0;
for (let i = 0; i < N; i++) {
  const p = {};
  for (const [k, [lo, hi, st]] of Object.entries(PARAM_RANGES)) p[k] = Math.round((lo + rnd() * (hi - lo)) / st) * st;
  const b = buildMugSteps(p, { seamAtBack });
  if (b.failed) {
    fails++;
    const g = handleGeometry({ ...p });
    const top = g.zc + g.span / 2 + g.hp, bottom = g.zc - g.span / 2 - g.hp;
    const why = [];
    if (p.bottomFillet <= p.wall) why.push(`bottomFillet ${p.bottomFillet} <= wall ${p.wall}`);
    if (top > p.height) why.push(`handle top ${top.toFixed(1)} > height ${p.height}`);
    if (bottom < p.bottomFillet) why.push(`handle bottom ${bottom.toFixed(1)} < bottomFillet ${p.bottomFillet}`);
    if (g.hp > g.rc) why.push(`tube r ${g.hp} > bend r ${g.rc.toFixed(1)}`);
    if (b.failed.key === "shell") (p.bottomFillet <= p.wall ? filletLeWall++ : shellFailOther++);
    console.log(`FAIL at ${b.failed.key}: ${why.join("; ") || "(no simple rule)"}  ${JSON.stringify(p)}`);
  }
  disposeBuild(b);
}
console.log(`\n${fails}/${N} failed; shell failures with bottomFillet<=wall: ${filletLeWall}, other shell failures: ${shellFailOther}`);
