import { formatDistanceToNow, format } from "date-fns"

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

export function countWords(text: string): number {
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

export function docStats(html: string) {
  const text = htmlToText(html)
  const words = countWords(text)
  const chars = text.replace(/\s/g, "").length
  const paragraphs = text.split(/\n+/).filter((l) => l.trim()).length
  const pages = Math.max(1, Math.ceil(words / 400))
  return { words, chars, paragraphs, pages, readingMinutes: Math.max(1, Math.round(words / 200)) }
}

export function getSnippet(html: string, len = 130): string {
  const text = htmlToText(html)
  if (text.length <= len) return text
  return text.slice(0, len).trimEnd() + "…"
}

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ""
  }
}

export function fullTime(iso: string): string {
  try {
    return format(new Date(iso), "MMM d, yyyy 'at' h:mm a")
  } catch {
    return ""
  }
}

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72]

export const FONT_FAMILIES = [
  "Arial",
  "Cambria",
  "Comic Sans MS",
  "Courier New",
  "Georgia",
  "Impact",
  "Palatino Linotype",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
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
