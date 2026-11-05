// Turn whatever the kernel threw into something a UI can show.
// With replicad-opencascadejs 1.x, OCCT C++ exceptions arrive in JS as native
// `WebAssembly.Exception` objects; `oc.getExceptionMessage(err)` decodes them
// into [typeName, message], e.g. ["StdFail_NotDone", "BRep_API: command not done"].
import { getOC } from "replicad";

export function describeError(err) {
  const oc = getOC();
  if (typeof WebAssembly !== "undefined" && WebAssembly.Exception && err instanceof WebAssembly.Exception) {
    let type = "OCCT exception";
    let message = "(no message)";
    try {
      const decoded = oc.getExceptionMessage(err);
      if (Array.isArray(decoded)) [type, message] = decoded;
      else if (decoded) message = String(decoded);
    } catch {
      /* keep defaults */
    }
    try {
      // Free the C++ exception object (Emscripten keeps it alive until released).
      oc.decrementExceptionRefcount(err);
    } catch {
      /* not fatal */
    }
    return { kind: "occt", type, message };
  }
  if (typeof err === "number") {
    // Older opencascade.js builds threw a raw pointer.
    try {
      const failure = oc.OCJS.getStandard_FailureData(err);
      return { kind: "occt-pointer", type: "Standard_Failure", message: String(failure.GetMessageString?.() ?? err) };
    } catch {
      return { kind: "occt-pointer", type: "unknown", message: `raw exception pointer ${err}` };
    }
  }
  return { kind: "js", type: err?.name ?? "Error", message: String(err?.message ?? err) };
}
