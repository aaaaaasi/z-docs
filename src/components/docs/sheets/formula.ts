import type { SheetData } from "@/lib/workspace-types"
import { cellRef, formatNumber, parseRef } from "./cells"
import { FormulaError, parseFormula, type Node } from "./formula-parser"

/* =========================================================================
   Z-Sheets formula evaluator — coercions, functions, dependency evaluation
   with memoization + cycle detection. Grammar lives in formula-parser.ts.
   ========================================================================= */

type Scalar = number | string | boolean
/** a range value — only meaningful as a function argument */
interface RangeVal {
  refs: string[]
}
type Value = Scalar | RangeVal
/* ------------------------------ coercions ------------------------------- */

function toNum(v: Scalar): number {
  if (typeof v === "number") return v
  if (typeof v === "boolean") return v ? 1 : 0
  const s = v.trim()
  if (s === "") return 0
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return Number(s)
  const up = s.toUpperCase()
  if (up === "TRUE") return 1
  if (up === "FALSE") return 0
  throw new FormulaError("#ERROR!")
}

function toStr(v: Scalar): string {
  if (typeof v === "string") return v
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  return formatNumber(v)
}

function toBool(v: Scalar): boolean {
  if (typeof v === "boolean") return v
  if (typeof v === "number") return v !== 0
  const s = v.trim().toUpperCase()
  if (s === "TRUE") return true
  if (s === "FALSE" || s === "") return false
  throw new FormulaError("#ERROR!")
}

/** type rank for mixed comparisons (number < text < boolean, Excel-style) */
function rank(v: Scalar): number {
  if (typeof v === "number") return 0
  if (typeof v === "string") return 1
  return 2
}

function compare(l: Scalar, r: Scalar): number {
  if (typeof l === "number" && typeof r === "number") return l - r
  if (typeof l === "string" && typeof r === "string") {
    const a = l.toLowerCase()
    const b = r.toLowerCase()
    return a < b ? -1 : a > b ? 1 : 0
  }
  if (typeof l === "boolean" && typeof r === "boolean") return (l ? 1 : 0) - (r ? 1 : 0)
  return rank(l) - rank(r)
}

/* ------------------------------ evaluation ------------------------------ */

interface Ctx {
  /** evaluate one cell by ref (dependency-aware, memoized, cycle-detecting) */
  cell(ref: string): Scalar
  rows: number
  cols: number
}

/** expand a range (clamped to the grid) into normalized refs */
function expandRange(a: string, b: string, ctx: Ctx): string[] {
  const pa = parseRef(a)
  const pb = parseRef(b)
  if (!pa || !pb) throw new FormulaError("#ERROR!")
  const r0 = Math.max(0, Math.min(pa.r, pb.r))
  const r1 = Math.min(ctx.rows - 1, Math.max(pa.r, pb.r))
  const c0 = Math.max(0, Math.min(pa.c, pb.c))
  const c1 = Math.min(ctx.cols - 1, Math.max(pa.c, pb.c))
  const refs: string[] = []
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) refs.push(cellRef(r, c))
  }
  return refs
}

function isRange(v: Value): v is RangeVal {
  return typeof v === "object" && v !== null && "refs" in v
}

/** evaluate a node to a Value (ranges stay ranges) */
function evalNode(n: Node, ctx: Ctx): Value {
  switch (n.k) {
    case "num":
      return n.v
    case "str":
      return n.v
    case "bool":
      return n.v
    case "ref":
      return ctx.cell(n.ref)
    case "range":
      return { refs: expandRange(n.a, n.b, ctx) }
    case "un": {
      const v = expectScalar(evalNode(n.x, ctx))
      return n.op === "-" ? -toNum(v) : toNum(v)
    }
    case "bin": {
      // IF short-circuit is handled at call level; binary ops need scalars
      const lv = expectScalar(evalNode(n.l, ctx))
      const rv = expectScalar(evalNode(n.r, ctx))
      return applyBin(n.op, lv, rv)
    }
    case "call":
      return callFunction(n, ctx)
    default:
      throw new FormulaError("#ERROR!")
  }
}

function expectScalar(v: Value): Scalar {
  if (isRange(v)) throw new FormulaError("#ERROR!")
  return v
}

function applyBin(op: string, l: Scalar, r: Scalar): Scalar {
  switch (op) {
    case "+":
      return checkNum(toNum(l) + toNum(r))
    case "-":
      return checkNum(toNum(l) - toNum(r))
    case "*":
      return checkNum(toNum(l) * toNum(r))
    case "/": {
      const d = toNum(r)
      if (d === 0) throw new FormulaError("#DIV/0!")
      return checkNum(toNum(l) / d)
    }
    case "%": {
      // modulo, Excel sign semantics
      const d = toNum(r)
      if (d === 0) throw new FormulaError("#DIV/0!")
      return checkNum(((toNum(l) % d) + d) % d)
    }
    case "^":
      return checkNum(Math.pow(toNum(l), toNum(r)))
    case "&":
      return toStr(l) + toStr(r)
    case "=":
      return compare(l, r) === 0
    case "<>":
      return compare(l, r) !== 0
    case "<":
      return compare(l, r) < 0
    case "<=":
      return compare(l, r) <= 0
    case ">":
      return compare(l, r) > 0
    case ">=":
      return compare(l, r) >= 0
    default:
      throw new FormulaError("#ERROR!")
  }
}

function checkNum(n: number): number {
  if (!Number.isFinite(n)) throw new FormulaError("#ERROR!")
  return n
}

/* ------------------------------- functions ------------------------------ */

type FnImpl = (n: { k: "call"; name: string; args: Node[] }, ctx: Ctx) => Scalar

/** collect scalar args, flattening ranges into their cell values */
function flatArgs(n: { k: "call"; name: string; args: Node[] }, ctx: Ctx): Scalar[] {
  const out: Scalar[] = []
  for (const a of n.args) {
    const v = evalNode(a, ctx)
    if (isRange(v)) {
      for (const ref of v.refs) out.push(ctx.cell(ref))
    } else out.push(v)
  }
  return out
}

/** lenient numeric coercion for aggregates — null means "skip this value" */
function numCoerce(v: Scalar): number | null {
  if (typeof v === "number") return v
  if (typeof v === "boolean") return v ? 1 : 0
  const s = v.trim()
  if (s === "") return null
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return Number(s)
  const up = s.toUpperCase()
  if (up === "TRUE") return 1
  if (up === "FALSE") return 0
  return null
}

function numsOf(vals: Scalar[]): number[] {
  const out: number[] = []
  for (const v of vals) {
    const n = numCoerce(v)
    if (n !== null) out.push(n)
  }
  return out
}

function roundHalfAway(n: number, digits: number): number {
  const f = Math.pow(10, digits)
  return (Math.sign(n) * Math.round(Math.abs(n) * f)) / f
}

const FUNCS: Record<string, FnImpl> = {
  SUM: (n, ctx) => checkNum(numsOf(flatArgs(n, ctx)).reduce((a, b) => a + b, 0)),
  AVERAGE: (n, ctx) => {
    const nums = numsOf(flatArgs(n, ctx))
    if (nums.length === 0) throw new FormulaError("#DIV/0!")
    return checkNum(nums.reduce((a, b) => a + b, 0) / nums.length)
  },
  MIN: (n, ctx) => {
    const nums = numsOf(flatArgs(n, ctx))
    return nums.length ? Math.min(...nums) : 0
  },
  MAX: (n, ctx) => {
    const nums = numsOf(flatArgs(n, ctx))
    return nums.length ? Math.max(...nums) : 0
  },
  COUNT: (n, ctx) => numsOf(flatArgs(n, ctx)).length,
  COUNTA: (n, ctx) =>
    flatArgs(n, ctx).filter((v) => !(typeof v === "string" && v.trim() === "")).length,
  ROUND: (n, ctx) => {
    const vals = flatArgs(n, ctx)
    if (vals.length < 1 || vals.length > 2) throw new FormulaError("#ERROR!")
    const digits = vals.length === 2 ? Math.trunc(toNum(vals[1])) : 0
    return roundHalfAway(toNum(vals[0]), Math.min(15, Math.max(-15, digits)))
  },
  ABS: (n, ctx) => Math.abs(num1(n, ctx)),
  SQRT: (n, ctx) => {
    const x = num1(n, ctx)
    if (x < 0) throw new FormulaError("#ERROR!")
    return Math.sqrt(x)
  },
  POWER: (n, ctx) => {
    const v = flatArgs(n, ctx)
    if (v.length !== 2) throw new FormulaError("#ERROR!")
    return checkNum(Math.pow(toNum(v[0]), toNum(v[1])))
  },
  INT: (n, ctx) => Math.floor(num1(n, ctx)),
  MEDIAN: (n, ctx) => {
    const nums = numsOf(flatArgs(n, ctx)).sort((a, b) => a - b)
    if (nums.length === 0) throw new FormulaError("#ERROR!")
    const mid = Math.floor(nums.length / 2)
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
  },
  IF: (n, ctx) => {
    if (n.args.length < 2 || n.args.length > 3) throw new FormulaError("#ERROR!")
    const cond = toBool(expectScalar(evalNode(n.args[0], ctx)))
    if (cond) return expectScalar(evalNode(n.args[1], ctx))
    if (n.args.length === 3) return expectScalar(evalNode(n.args[2], ctx))
    return false
  },
  AND: (n, ctx) => logicArgs(n, ctx, (a, b) => a && b, true),
  OR: (n, ctx) => logicArgs(n, ctx, (a, b) => a || b, false),
  NOT: (n, ctx) => !bool1(n, ctx),
  CONCAT: (n, ctx) => flatArgs(n, ctx).map(toStr).join(""),
  LEN: (n, ctx) => str1(n, ctx).length,
  UPPER: (n, ctx) => str1(n, ctx).toUpperCase(),
  LOWER: (n, ctx) => str1(n, ctx).toLowerCase(),
  TRIM: (n, ctx) => str1(n, ctx).trim().replace(/\s+/g, " "),
}

function num1(n: { k: "call"; name: string; args: Node[] }, ctx: Ctx): number {
  const v = flatArgs(n, ctx)
  if (v.length !== 1) throw new FormulaError("#ERROR!")
  return toNum(v[0])
}
function str1(n: { k: "call"; name: string; args: Node[] }, ctx: Ctx): string {
  const v = flatArgs(n, ctx)
  if (v.length !== 1) throw new FormulaError("#ERROR!")
  return toStr(v[0])
}
function bool1(n: { k: "call"; name: string; args: Node[] }, ctx: Ctx): boolean {
  const v = flatArgs(n, ctx)
  if (v.length !== 1) throw new FormulaError("#ERROR!")
  return toBool(v[0])
}

function logicArgs(
  n: { k: "call"; name: string; args: Node[] },
  ctx: Ctx,
  fold: (a: boolean, b: boolean) => boolean,
  seed: boolean
): boolean {
  const vals = flatArgs(n, ctx)
  const bools = vals.filter((v) => !(typeof v === "string" && v.trim() === "")).map(toBool)
  if (bools.length === 0) throw new FormulaError("#ERROR!")
  return bools.reduce(fold, seed)
}

function callFunction(n: { k: "call"; name: string; args: Node[] }, ctx: Ctx): Scalar {
  const fn = FUNCS[n.name]
  if (!fn) throw new FormulaError("#NAME?")
  return fn(n, ctx)
}

/* ------------------------------ sheet eval ------------------------------ */

/** parse a raw (non-formula) cell value into a scalar */
function parseLiteral(raw: string): Scalar {
  const t = raw.trim()
  if (t === "") return ""
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return Number(t)
  const up = t.toUpperCase()
  if (up === "TRUE") return true
  if (up === "FALSE") return false
  return raw
}

function displayScalar(v: Scalar): string {
  if (typeof v === "number") return formatNumber(v)
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  return v
}

/**
 * Evaluate every non-empty cell of a sheet and return the computed display
 * string per cell ref. Formulas ("=…") are parsed and evaluated with
 * dependency memoization and cycle detection.
 */
export function evaluateSheet(data: SheetData): Record<string, string> {
  const out: Record<string, string> = {}
  const cells = data.cells

  const memo = new Map<string, Scalar>()
  /** memoized error codes so referencing an errored cell propagates the error */
  const errMemo = new Map<string, string>()
  const visiting = new Set<string>()
  const astCache = new Map<string, Node | null>()
  const ctx: Ctx = {
    rows: data.rows,
    cols: data.cols,
    cell(ref: string): Scalar {
      const key = ref.toUpperCase()
      const err = errMemo.get(key)
      if (err !== undefined) throw new FormulaError(err)
      const hit = memo.get(key)
      if (hit !== undefined) return hit
      if (visiting.has(key)) throw new FormulaError("#CIRC!")
      const raw = cells[key]?.v
      if (raw === undefined || raw === "") {
        memo.set(key, "")
        return ""
      }
      visiting.add(key)
      try {
        let ast: Node | null | undefined = astCache.get(key)
        if (ast === undefined) {
          ast = raw.startsWith("=") ? parseFormula(raw.slice(1)) : null
          astCache.set(key, ast)
        }
        const v: Scalar = ast ? expectScalar(evalNode(ast, ctx)) : parseLiteral(raw)
        memo.set(key, v)
        return v
      } catch (e) {
        const code = e instanceof FormulaError ? e.code : "#ERROR!"
        errMemo.set(key, code)
        throw new FormulaError(code)
      } finally {
        visiting.delete(key)
      }
    },
  }

  for (const ref of Object.keys(cells)) {
    const raw = cells[ref]?.v
    if (raw === undefined || raw === "") continue
    try {
      out[ref] = displayScalar(ctx.cell(ref))
    } catch (e) {
      out[ref] = e instanceof FormulaError ? e.code : "#ERROR!"
    }
  }
  return out
}
