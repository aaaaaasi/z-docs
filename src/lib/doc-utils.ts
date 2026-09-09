import { formatDistanceToNow, format } from "date-fns"
import { zhCN } from "date-fns/locale"
import type { Lang } from "@/lib/i18n"

/** date-fns locale for a UI language */
export function dateLocale(lang: Lang) {
  return lang === "zh" ? zhCN : undefined
}

/** Strip HTML tags and decode entities — safe on server & client */
export function htmlToText(html: string): string {
  if (!html) return ""
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * 字数 per the Microsoft Word convention: every CJK ideograph/kana counts
 * as 1, plus each maximal Latin/alphanumeric word run counts as 1 — so a
 * pure-Chinese paragraph is no longer “1 word” (the old whitespace-split
 * bug that reported 42 words for a 1,987-char document).
 */
const CJK_COUNT_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/
const WORD_RUN_RE = /[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/
const ANY_TOKEN_RE = new RegExp(
  CJK_COUNT_RE.source + "|" + WORD_RUN_RE.source,
  "g"
)

export function countWords(text: string): number {
  if (!text) return 0
  let n = 0
  for (const _m of text.matchAll(ANY_TOKEN_RE)) n++
  return n
}

export function countCjkChars(text: string): number {
  let n = 0
  for (const ch of text) if (CJK_COUNT_RE.test(ch)) n++
  return n
}

export function countLatinWords(text: string): number {
  let n = 0
  for (const _m of text.matchAll(new RegExp(WORD_RUN_RE.source, "g"))) n++
  return n
}

export interface DocStats {
  words: number
  chars: number
  cjkChars: number
  latinWords: number
  isCJK: boolean
  paragraphs: number
  pages: number
  readingMinutes: number
}

/**
 * Word-style document statistics.
 * · 阅读时间: zh 成人平均默读 ~300 字/分钟 + en 200 wpm，加权兼容混排。
 * · 页数: zh ~900 字/页（A4 编辑器版式），en 400 词/页。
 */
export function docStats(html: string): DocStats {
  const text = htmlToText(html)
  const cjkChars = countCjkChars(text)
  const latinWords = countLatinWords(text)
  const words = cjkChars + latinWords
  const chars = text.replace(/\s/g, "").length
  const paragraphs = text.split(/\n+/).filter((l) => l.trim()).length
  const isCJK = words > 0 && cjkChars / words >= 0.5
  const pages = Math.max(1, Math.ceil(Math.max(cjkChars / 900, latinWords / 400)))
  const readingMinutes = Math.max(
    1,
    Math.round(cjkChars / 300 + latinWords / 200)
  )
  return { words, chars, cjkChars, latinWords, isCJK, paragraphs, pages, readingMinutes }
}

export function getSnippet(html: string, len = 130): string {
  const text = htmlToText(html)
  if (text.length <= len) return text
  return text.slice(0, len).trimEnd() + "…"
}

/* ---------------- search matching (shared by API + guest local mode + UI) ---------------- */

export interface SearchMatchInfo {
  /** total term occurrences across title + body */
  count: number
  /** up to N paragraph-level context snippets containing the hits */
  snippets: string[]
}

/** Split a raw query into individual terms — whitespace-separated, Latin
 *  lowercased for case-insensitive matching, CJK runs kept whole. */
export function searchTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function countOccurrences(haystack: string, needle: string): number {
  let n = 0
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    n++
    at = haystack.indexOf(needle, at + needle.length)
  }
  return n
}

/** Multi-term AND search (researched pattern: Meilisearch-style match totals +
 *  context snippets). Returns null unless EVERY term occurs in title or body;
 *  otherwise returns the total hit count and up to `max` paragraph snippets
 *  (window around the first hit, ellipsized, ready for term highlighting). */
export function buildSearchMatches(
  title: string,
  contentHtml: string,
  query: string,
  max = 3
): SearchMatchInfo | null {
  const terms = searchTerms(query)
  if (terms.length === 0) return null
  const hayTitle = title.toLowerCase()
  const text = htmlToText(contentHtml)
  const hay = text.toLowerCase()

  let count = 0
  for (const term of terms) {
    const hits = countOccurrences(hay, term) + countOccurrences(hayTitle, term)
    if (hits === 0) return null // AND semantics: every term must match somewhere
    count += hits
  }

  const snippets: string[] = []
  for (const para of text.split(/\n+/)) {
    if (snippets.length >= max) break
    const p = para.trim()
    if (!p) continue
    const lp = p.toLowerCase()
    let at = -1
    for (const term of terms) {
      at = lp.indexOf(term)
      if (at !== -1) break
    }
    if (at === -1) continue
    const start = Math.max(0, at - 32)
    const end = Math.min(p.length, at + 72)
    const prefix = start > 0 ? "…" : ""
    const suffix = end < p.length ? "…" : ""
    snippets.push(prefix + p.slice(start, end).trim() + suffix)
  }
  // title-only match: fall back to the title itself so the hit stays visible
  if (snippets.length === 0 && title) snippets.push(title.slice(0, 90))
  return { count, snippets }
}

/** Split `text` into segments so the UI can wrap matched terms in <mark>. */
export function splitByTerms(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = searchTerms(query)
  if (terms.length === 0 || !text) return [{ text, hit: false }]
  const re = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi")
  const parts: { text: string; hit: boolean }[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0
    if (i > last) parts.push({ text: text.slice(last, i), hit: false })
    parts.push({ text: m[0] ?? "", hit: true })
    last = i + (m[0]?.length ?? 0)
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false })
  return parts.length ? parts : [{ text, hit: false }]
}

export function relativeTime(iso: string, lang: Lang = "zh"): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: dateLocale(lang) })
  } catch {
    return ""
  }
}

export function fullTime(iso: string, lang: Lang = "zh"): string {
  try {
    return lang === "zh"
      ? format(new Date(iso), "yyyy年M月d日 HH:mm")
      : format(new Date(iso), "MMM d, yyyy 'at' h:mm a")
  } catch {
    return ""
  }
}

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72]

/** One picker entry: what the user sees vs the CSS stack actually applied.
 *  CJK entries use cross-platform stacks (researched standard order:
 *  macOS PingFang SC → Windows Microsoft YaHei → Linux/general Noto Sans CJK)
 *  so a document authored on one OS renders with the local equivalent elsewhere. */
export interface FontFamilyOption {
  label: string
  stack: string
  /** tiny sample text rendered in the entry itself */
  sample: string
}

export const FONT_FAMILIES: FontFamilyOption[] = [
  { label: "Arial", stack: "Arial, sans-serif", sample: "Aa 永字" },
  { label: "Cambria", stack: "Cambria, serif", sample: "Aa 永字" },
  { label: "Comic Sans MS", stack: "\"Comic Sans MS\", cursive", sample: "Aa 永字" },
  { label: "Courier New", stack: "\"Courier New\", monospace", sample: "Aa 永字" },
  { label: "Georgia", stack: "Georgia, serif", sample: "Aa 永字" },
  { label: "Impact", stack: "Impact, sans-serif", sample: "Aa 永字" },
  { label: "Palatino Linotype", stack: "\"Palatino Linotype\", serif", sample: "Aa 永字" },
  { label: "Times New Roman", stack: "\"Times New Roman\", serif", sample: "Aa 永字" },
  { label: "Trebuchet MS", stack: "\"Trebuchet MS\", sans-serif", sample: "Aa 永字" },
  { label: "Verdana", stack: "Verdana, sans-serif", sample: "Aa 永字" },
  // ---- Chinese fonts (system stacks, zero-download) ----
  { label: "苹方 PingFang SC", stack: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif', sample: "字体预览" },
  { label: "微软雅黑 YaHei", stack: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', sample: "字体预览" },
  { label: "思源黑体 Noto", stack: '"Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif', sample: "字体预览" },
  { label: "宋体 SimSun", stack: 'SimSun, "Songti SC", "Noto Serif SC", serif', sample: "字体预览" },
  { label: "楷体 KaiTi", stack: 'KaiTi, Kaiti SC, STKaiti, "PingFang SC", serif', sample: "字体预览" },
  { label: "黑体 SimHei", stack: 'SimHei, "Heiti SC", "Microsoft YaHei", sans-serif', sample: "字体预览" },
]

export const PRESENCE_COLORS = [
  "#e05252",
  "#e08a3c",
  "#c9a227",
  "#5aa02c",
  "#1f8a5f",
  "#0e7c74",
  "#5e7050",
  "#8d5a74",
  "#b05a86",
  "#d1568f",
]

export function colorForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

export function initialsOf(name: string): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const second = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + second).toUpperCase() || name.slice(0, 2).toUpperCase()
}

/** Text grid palette for the text-color / highlight pickers */
export const TEXT_COLOR_PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  "#cc4125", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd",
  "#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79",
  "#85200c", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47",
  "#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130",
]

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
