// Minimal globals for Apple's `jsc` shell (JavaScriptCore = Safari's JS/wasm engine).
const g = globalThis;
if (typeof g.console === "undefined") {
  const out = (...a) => g.print(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  g.console = { log: out, info: out, warn: out, error: out, debug: () => {} };
}
if (typeof g.performance === "undefined" || typeof g.performance.now !== "function") {
  const t0 = g.preciseTime();
  g.performance = { now: () => (g.preciseTime() - t0) * 1000 };
}
if (typeof g.TextDecoder === "undefined") {
  g.TextDecoder = class {
    decode(bytes) {
      if (!bytes) return "";
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer ?? bytes);
      let s = "";
      for (let i = 0; i < u8.length; ) {
        const c = u8[i++];
        if (c < 0x80) s += String.fromCharCode(c);
        else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (u8[i++] & 0x3f));
        else if (c < 0xf0) s += String.fromCharCode(((c & 0x0f) << 12) | ((u8[i++] & 0x3f) << 6) | (u8[i++] & 0x3f));
        else {
          const cp = ((c & 0x07) << 18) | ((u8[i++] & 0x3f) << 12) | ((u8[i++] & 0x3f) << 6) | (u8[i++] & 0x3f);
          s += String.fromCodePoint(cp);
        }
      }
      return s;
    }
  };
}
if (typeof g.TextEncoder === "undefined") {
  g.TextEncoder = class {
    encode(str) {
      const out = [];
      for (const ch of str) {
        const cp = ch.codePointAt(0);
        if (cp < 0x80) out.push(cp);
        else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
        else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      }
      return new Uint8Array(out);
    }
  };
}
if (typeof g.crypto === "undefined") {
  g.crypto = {
    getRandomValues(arr) {
      for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() * 256) | 0;
      return arr;
    },
  };
}
