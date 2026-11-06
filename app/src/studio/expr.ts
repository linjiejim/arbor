/**
 * Parameter expressions: numbers, named parameters, + - * / ^, parentheses and
 * a few functions. A tiny recursive-descent parser, so nothing the model writes
 * is ever passed to eval().
 */

export type Scope = Record<string, number>

const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  min: Math.min,
  max: Math.max,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  // Trig in degrees: that is how every CAD dialog speaks.
  sin: (d) => Math.sin((d * Math.PI) / 180),
  cos: (d) => Math.cos((d * Math.PI) / 180),
  tan: (d) => Math.tan((d * Math.PI) / 180),
  atan: (x) => (Math.atan(x) * 180) / Math.PI,
}
const CONSTS: Record<string, number> = { pi: Math.PI }

export class ExprError extends Error {}

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string }

function lex(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i))
      if (!m) throw new ExprError(`看不懂的数字：${src.slice(i, i + 8)}`)
      out.push({ t: "num", v: Number(m[0]) })
      i += m[0].length
    } else if (/[A-Za-z_一-龥]/.test(c)) {
      const m = /^[A-Za-z_一-龥][A-Za-z0-9_一-龥]*/.exec(src.slice(i))!
      out.push({ t: "id", v: m[0] })
      i += m[0].length
    } else if ("+-*/^(),".includes(c)) {
      out.push({ t: "op", v: c })
      i++
    } else {
      throw new ExprError(`表达式里有不支持的字符「${c}」`)
    }
  }
  return out
}

/** Models sometimes double-encode a name as "\"d\""; the quotes carry no meaning. */
export const unquote = (src: string) => src.replace(/^\s*(["'])(.*)\1\s*$/, "$2")

// Own keys only: "constructor" is not a function an expression may call.
const isFunc = (name: string) => Object.hasOwn(FUNCS, name)
const isConst = (name: string) => Object.hasOwn(CONSTS, name)

/** Functions and constants an expression may use (what exported code has to provide). */
export const FUNC_NAMES = Object.keys(FUNCS)
export const CONST_NAMES = Object.keys(CONSTS)

/** Names referenced by an expression (for dependency order and "unknown parameter" errors). */
export function namesIn(src: string): string[] {
  return lex(unquote(src))
    .filter((t): t is { t: "id"; v: string } => t.t === "id" && !isFunc(t.v) && !isConst(t.v))
    .map((t) => t.v)
}

/** A parsed expression. `name` is a parameter or a constant; `call` only ever names one of FUNCS. */
export type ExprNode =
  | { k: "num"; v: number }
  | { k: "name"; v: string }
  | { k: "neg"; a: ExprNode }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: ExprNode; b: ExprNode }
  | { k: "call"; f: string; args: ExprNode[] }

/** Syntax only: bad syntax throws, unknown names don't (that needs a scope). */
export function parse(raw: string): ExprNode {
  const src = unquote(raw)
  const toks = lex(src)
  let p = 0
  const peek = () => toks[p]
  const isOp = (...ops: string[]) => peek()?.t === "op" && ops.includes(String(peek().v))
  const eat = (v?: string) => {
    const t = toks[p]
    if (!t || (v !== undefined && !(t.t === "op" && t.v === v))) throw new ExprError(`表达式不完整：${src}`)
    p++
    return t
  }
  const expr = (): ExprNode => {
    let a = term()
    while (isOp("+", "-")) {
      const op = eat().v as "+" | "-"
      a = { k: "bin", op, a, b: term() }
    }
    return a
  }
  const term = (): ExprNode => {
    let a = power()
    while (isOp("*", "/")) {
      const op = eat().v as "*" | "/"
      a = { k: "bin", op, a, b: power() }
    }
    return a
  }
  const power = (): ExprNode => {
    const a = unary()
    if (!isOp("^")) return a
    eat()
    return { k: "bin", op: "^", a, b: power() }
  }
  const unary = (): ExprNode => {
    if (isOp("-")) {
      eat()
      return { k: "neg", a: unary() }
    }
    if (isOp("+")) {
      eat()
      return unary()
    }
    return atom()
  }
  const atom = (): ExprNode => {
    const t = eat()
    if (t.t === "num") return { k: "num", v: t.v }
    if (t.t === "op" && t.v === "(") {
      const v = expr()
      eat(")")
      return v
    }
    if (t.t === "id") {
      if (!isFunc(t.v)) return { k: "name", v: t.v }
      eat("(")
      const args = [expr()]
      while (isOp(",")) {
        eat()
        args.push(expr())
      }
      eat(")")
      return { k: "call", f: t.v, args }
    }
    throw new ExprError(`表达式不完整：${src}`)
  }
  const node = expr()
  if (p !== toks.length) throw new ExprError(`表达式多了内容：${src}`)
  return node
}

function run(n: ExprNode, scope: Scope): number {
  switch (n.k) {
    case "num":
      return n.v
    case "name":
      if (isConst(n.v)) return CONSTS[n.v]
      if (Object.hasOwn(scope, n.v)) return scope[n.v]
      throw new ExprError(`没有名为「${n.v}」的参数`)
    case "neg":
      return -run(n.a, scope)
    case "call":
      return FUNCS[n.f](...n.args.map((a) => run(a, scope)))
    case "bin": {
      const a = run(n.a, scope)
      const b = run(n.b, scope)
      return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : n.op === "/" ? a / b : a ** b
    }
  }
}

export function evaluate(raw: string, scope: Scope): number {
  const v = run(parse(raw), scope)
  if (!Number.isFinite(v)) throw new ExprError(`表达式的结果不是有限数：${unquote(raw)}`)
  return v
}

/** A number, or an expression string over the parameters. */
export type NumLike = number | string

export function num(v: NumLike, scope: Scope): number {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new ExprError("数值不是有限数")
    return v
  }
  return evaluate(v, scope)
}

/**
 * Resolve a parameter table where values may reference other parameters, in
 * dependency order. Throws on unknown names and cycles.
 */
export function resolveParams(params: Record<string, NumLike>): Scope {
  const scope: Scope = {}
  const visiting = new Set<string>()
  const visit = (name: string) => {
    if (name in scope) return
    if (visiting.has(name)) throw new ExprError(`参数「${name}」循环引用了自己`)
    const v = params[name]
    if (v === undefined) throw new ExprError(`没有名为「${name}」的参数`)
    visiting.add(name)
    if (typeof v === "string") for (const dep of namesIn(v)) visit(dep)
    scope[name] = num(v, scope)
    visiting.delete(name)
  }
  for (const name of Object.keys(params)) visit(name)
  return scope
}
