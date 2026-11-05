import opencascade from "replicad-opencascadejs";
import { setOC } from "replicad";
import { runExtras } from "../src/kernel/extras.js";
const oc = await opencascade();
setOC(oc);
for (const r of runExtras()) console.log(JSON.stringify(r.info));
