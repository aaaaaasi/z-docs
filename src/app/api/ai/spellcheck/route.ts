import { NextRequest, NextResponse } from "next/server"
import ZAI from "z-ai-web-dev-sdk"
import { guardRoute } from "@/lib/server-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Hard caps shared with the client dialog. */
const MAX_TEXT = 12_000
const MAX_ISSUES = 30
const MAX_QUOTE = 200
const VALID_TYPES = new Set(["spelling", "grammar", "punctuation", "style"])

interface SpellIssue {
  /** verbatim fragment of the source text (the client locates & replaces it) */
  quote: string
  type: "spelling" | "grammar" | "punctuation" | "style"
  /** replacement text ("" when there is no safe suggestion) */
  suggestion: string
  /** short Simplified-Chinese explanation shown in the UI */
  message: string
}

const SYSTEM_PROMPT =
  "你是 Z-Docs 文档编辑器内置的拼写与语法检查器。分析用户提供的文档文本，找出真实存在的拼写、语法、标点和明显风格问题。" +
  "只输出一个 JSON 数组，不要输出任何其他文字、解释或 markdown 代码块。输出格式严格遵守：" +
  '[{"quote":"<原文中精确的出错文本片段>","type":"spelling|grammar|punctuation|style","suggestion":"<修正建议，无建议则为空字符串>","message":"<简短中文说明>"}]。' +
  "要求：" +
  "1) quote 必须逐字复制原文（保留原有的空格、标点与大小写），绝不可改写、缩写或翻译——系统将用 quote 在原文中定位并替换；" +
  "2) 每处错误只报告一次；" +
  "3) 只报告确实存在的问题，避免过度纠正（风格问题只报明显可改进之处）；" +
  `4) 最多 ${MAX_ISSUES} 条；` +
  "5) message 一律使用简体中文，一句话说明问题；message 中禁止使用英文双引号，引用词语时用「」；" +
  "6) JSON 字符串值内的双引号必须用反斜杠转义（\\\"）；" +
  "7) 若文本没有问题，只输出 []。"

/** Remove ``` / ```json fences the model sometimes wraps around its output. */
function stripFences(raw: string): string {
  const s = raw.trim()
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return m ? m[1] : s
}

/**
 * Repair a common LLM JSON defect: unescaped double quotes INSIDE string
 * values (e.g. "message":""word" 拼写错误，应为"word""). While inside a
 * string, a quote is treated as the CLOSING quote only when the next
 * non-space character is a structural delimiter (, : } ] or end);
 * otherwise it is escaped as an inner quote.
 */
function repairUnescapedQuotes(s: string): string {
  let out = ""
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === "\\") {
      out += c + (s[i + 1] ?? "")
      i++
      continue
    }
    if (c === '"') {
      if (!inStr) {
        inStr = true
      } else {
        let j = i + 1
        while (j < s.length && /\s/.test(s[j])) j++
        const next = s[j] ?? ""
        if (next === "" || next === "," || next === ":" || next === "}" || next === "]") {
          inStr = false // genuine closing quote
        } else {
          out += '\\"' // unescaped inner quote — escape it
          continue
        }
      }
    }
    out += c
  }
  return out
}

/**
 * Defensive array extraction, most-likely first:
 *   1. direct JSON.parse (of the fenced-stripped text)
 *   2. JSON.parse of the first "["…"]" span
 *   3. quote-repaired variants of both
 * Returns null when no array can be recovered.
 */
function parseIssueArray(raw: string): unknown[] | null {
  const s = stripFences(raw)
  const candidates: string[] = [s]
  const start = s.indexOf("[")
  const end = s.lastIndexOf("]")
  if (start !== -1 && end > start) candidates.push(s.slice(start, end + 1))
  for (const c of candidates) {
    try {
      const parsed: unknown = JSON.parse(c)
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* try next candidate */
    }
  }
  // last resort: repair unescaped inner quotes and retry
  for (const c of candidates) {
    try {
      const parsed: unknown = JSON.parse(repairUnescapedQuotes(c))
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* unrecoverable */
    }
  }
  return null
}

/** Validate + normalize one raw entry coming from the model. */
function toIssue(item: unknown): SpellIssue | null {
  if (!item || typeof item !== "object") return null
  const o = item as Record<string, unknown>
  const quote = typeof o.quote === "string" ? o.quote.trim() : ""
  if (!quote || quote.length > MAX_QUOTE) return null
  const type =
    typeof o.type === "string" && VALID_TYPES.has(o.type)
      ? (o.type as SpellIssue["type"])
      : "grammar"
  const suggestion =
    typeof o.suggestion === "string" ? o.suggestion.trim().slice(0, MAX_QUOTE) : ""
  const message = typeof o.message === "string" ? o.message.trim().slice(0, MAX_QUOTE) : ""
  return { quote, type, suggestion, message }
}

// POST /api/ai/spellcheck { text, lang }
export async function POST(req: NextRequest) {
  const g = await guardRoute(req, { mutating: true, limit: 6, windowMs: 60_000 })
  if (!g.ok) return g.response

  try {
    const body = (await req.json().catch(() => ({}))) as { text?: string; lang?: string }
    const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT) : ""
    if (!text.trim()) {
      return NextResponse.json({ issues: [] })
    }
    const lang = body.lang === "en" ? "en" : "zh"

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `检测语言：${lang === "zh" ? "简体中文" : "英语（English）"}。请检查以下文档文本：\n\n` +
            `----- TEXT START -----\n${text}\n----- TEXT END -----`,
        },
      ],
      thinking: { type: "disabled" },
    })

    const raw = completion.choices[0]?.message?.content ?? ""
    const arr = parseIssueArray(raw)
    if (!arr) {
      console.error("POST /api/ai/spellcheck: unparseable model output:", raw.slice(0, 500))
      return NextResponse.json(
        { error: "The AI returned an unparseable result — please retry." },
        { status: 502 }
      )
    }

    // Validate every entry: non-empty verbatim quote, sane length, and the
    // quote must actually occur in the source text so the client can locate it.
    const lower = text.toLowerCase()
    const issues: SpellIssue[] = []
    const seen = new Set<string>()
    for (const item of arr) {
      if (issues.length >= MAX_ISSUES) break
      const issue = toIssue(item)
      if (!issue) continue
      if (seen.has(issue.quote)) continue // report each error once
      if (!lower.includes(issue.quote.toLowerCase())) continue // not locatable
      seen.add(issue.quote)
      issues.push(issue)
    }

    return NextResponse.json({ issues })
  } catch (e) {
    console.error("POST /api/ai/spellcheck failed:", e)
    return NextResponse.json(
      { error: "The AI service is unavailable right now. Please try again." },
      { status: 502 }
    )
  }
}
