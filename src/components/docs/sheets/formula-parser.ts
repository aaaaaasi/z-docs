import { parseRef } from "./cells"

/* =========================================================================
   Z-Sheets formula grammar — tokenizer + recursive-descent parser.
   Grammar (lowest → highest precedence):
     comparison  := concat ( ('='|'<>'|'<'|'<='|'>'|'>=') concat )*
     concat      := additive ( '&' additive )*
     additive    := multiplicative ( ('+'|'-') multiplicative )*
     multiplicative := power ( ('*'|'/'|'%') power )*
     power       := unary ( '^' unary )*
     unary       := ('-'|'+') unary | primary
     primary     := NUMBER | STRING | TRUE | FALSE | cellref | range | call | '(' expr ')'
   Errors: #ERROR! (generic) · #NAME? (unknown identifier)
   ========================================================================= */

/** thrown for any formula error — code is the display string, e.g. "#DIV/0!" */
export class FormulaError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/* ------------------------------- tokenizer ------------------------------ */

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" }
  | { t: "colon" }

const OPS = ["<=", ">=", "<>", "+", "-", "*", "/", "^", "%", "&", "=", "<", ">"]

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++
      continue
    }
    if (ch === '"') {
      // string literal, "" escapes a quote (Excel style)
      let out = ""
      i++
      let closed = false
      while (i < src.length) {
        if (src[i] === '"') {
          if (src[i + 1] === '"') {
            out += '"'
            i += 2
            continue
          }
          i++
          closed = true
          break
        }
        out += src[i]
        i++
      }
      if (!closed) throw new FormulaError("#ERROR!")
      toks.push({ t: "str", v: out })
      continue
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      const num = Number(src.slice(i, j))
      if (!Number.isFinite(num)) throw new FormulaError("#ERROR!")
      toks.push({ t: "num", v: num })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      toks.push({ t: "ident", v: src.slice(i, j) })
      i = j
      continue
    }
    if (ch === "(") {
      toks.push({ t: "lp" })
      i++
      continue
    }
    if (ch === ")") {
      toks.push({ t: "rp" })
      i++
      continue
    }
    if (ch === "," || ch === ";") {
      toks.push({ t: "comma" })
      i++
      continue
    }
    if (ch === ":") {
      toks.push({ t: "colon" })
      i++
      continue
    }
    const two = src.slice(i, i + 2)
    if (OPS.includes(two)) {
      toks.push({ t: "op", v: two })
      i += 2
      continue
    }
    if (OPS.includes(ch)) {
      toks.push({ t: "op", v: ch })
      i++
      continue
    }
    throw new FormulaError("#ERROR!")
  }
  return toks
}

/* --------------------------------- parser ------------------------------- */

export type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "ref"; ref: string }
  | { k: "range"; a: string; b: string }
  | { k: "un"; op: "+" | "-"; x: Node }
  | { k: "bin"; op: string; l: Node; r: Node }
  | { k: "call"; name: string; args: Node[] }

class Parser {
  private pos = 0
  constructor(private readonly toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.pos]
  }
  private next(): Tok | undefined {
    return this.toks[this.pos++]
  }

  parse(): Node {
    const node = this.parseComparison()
    if (this.pos < this.toks.length) throw new FormulaError("#ERROR!")
    return node
  }

  private parseComparison(): Node {
    let l = this.parseConcat()
    for (;;) {
      const t = this.peek()
      if (t?.t === "op" && ["=", "<>", "<", "<=", ">", ">="].includes(t.v)) {
        this.next()
        const r = this.parseConcat()
        l = { k: "bin", op: t.v, l, r }
      } else return l
    }
  }

  private parseConcat(): Node {
    let l = this.parseAdditive()
    for (;;) {
      const t = this.peek()
      if (t?.t === "op" && t.v === "&") {
        this.next()
        const r = this.parseAdditive()
        l = { k: "bin", op: "&", l, r }
      } else return l
    }
  }

  private parseAdditive(): Node {
    let l = this.parseMultiplicative()
    for (;;) {
      const t = this.peek()
      if (t?.t === "op" && (t.v === "+" || t.v === "-")) {
        this.next()
        const r = this.parseMultiplicative()
        l = { k: "bin", op: t.v, l, r }
      } else return l
    }
  }

  private parseMultiplicative(): Node {
    let l = this.parsePower()
    for (;;) {
      const t = this.peek()
      if (t?.t === "op" && (t.v === "*" || t.v === "/" || t.v === "%")) {
        this.next()
        const r = this.parsePower()
        l = { k: "bin", op: t.v, l, r }
      } else return l
    }
  }

  private parsePower(): Node {
    let l = this.parseUnary()
    for (;;) {
      const t = this.peek()
      if (t?.t === "op" && t.v === "^") {
        this.next()
        const r = this.parseUnary()
        l = { k: "bin", op: "^", l, r }
      } else return l
    }
  }

  private parseUnary(): Node {
    const t = this.peek()
    if (t?.t === "op" && (t.v === "-" || t.v === "+")) {
      this.next()
      const x = this.parseUnary()
      return t.v === "-" ? { k: "un", op: "-", x } : x
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Node {
    const t = this.next()
    if (!t) throw new FormulaError("#ERROR!")
    if (t.t === "num") return { k: "num", v: t.v }
    if (t.t === "str") return { k: "str", v: t.v }
    if (t.t === "lp") {
      const e = this.parseComparison()
      if (this.next()?.t !== "rp") throw new FormulaError("#ERROR!")
      return e
    }
    if (t.t === "ident") {
      const up = t.v.toUpperCase()
      if (this.peek()?.t === "lp") {
        // function call
        this.next()
        const args: Node[] = []
        if (this.peek()?.t === "rp") {
          this.next()
          return { k: "call", name: up, args }
        }
        for (;;) {
          args.push(this.parseComparison())
          const nt = this.next()
          if (nt?.t === "comma") continue
          if (nt?.t === "rp") return { k: "call", name: up, args }
          throw new FormulaError("#ERROR!")
        }
      }
      if (up === "TRUE" && !isRefText(t.v)) return { k: "bool", v: true }
      if (up === "FALSE" && !isRefText(t.v)) return { k: "bool", v: false }
      const a = parseRef(t.v)
      if (a) {
        // possible range: A1:B3
        if (this.peek()?.t === "colon") {
          const save = this.pos
          this.next()
          const t2 = this.next()
          if (t2?.t === "ident") {
            const b = parseRef(t2.v)
            if (b) return { k: "range", a: t.v.toUpperCase(), b: t2.v.toUpperCase() }
          }
          this.pos = save
          throw new FormulaError("#ERROR!")
        }
        return { k: "ref", ref: t.v.toUpperCase() }
      }
      throw new FormulaError("#NAME?")
    }
    throw new FormulaError("#ERROR!")
  }
}

/** "TRUE"/"FALSE" are booleans, but "TRUE1"/"FAL" are refs — refs win when they parse */
function isRefText(v: string): boolean {
  return parseRef(v) !== null
}

/** parse a formula body (without the leading "=") into an AST */
export function parseFormula(src: string): Node {
  return new Parser(tokenize(src)).parse()
}
