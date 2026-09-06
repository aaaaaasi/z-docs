/**
 * Shared print/export document builder — ONE source of truth for the visual
 * layout of every file export (server PDF via Chromium, Word .doc, plain
 * .html, browser print). Isomorphic: no server-only or client-only imports.
 *
 * The CSS is tuned for Google-Docs print parity:
 *  - Letter page, 1in margins, 11pt body, 1.15 line height
 *  - `overflow-wrap: break-word` + `word-break: break-word` everywhere so a
 *    very long unbroken string (e.g. 200 "s" characters or a URL) wraps
 *    inside the page instead of overflowing the right edge (the exact bug
 *    reported on the old export path)
 *  - CJK-aware font stack (PingFang SC / Microsoft YaHei / WQY Zen Hei …)
 *  - real table borders, blockquote bar, code/pre, hr, image caps
 *  - print pagination niceties (page-break-inside: avoid, orphans/widows)
 */

export type PrintDocMode = "print" | "word" | "html"

export const PRINT_FONT_STACK = [
  "Arial",
  '"Helvetica Neue"',
  "Helvetica",
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK SC"',
  '"Noto Sans SC"',
  '"WenQuanYi Zen Hei"',
  "sans-serif",
].join(", ")

export const MONO_FONT_STACK = [
  '"Courier New"',
  '"Liberation Mono"',
  '"Sarasa Mono SC"',
  "Menlo",
  "Consolas",
  "monospace",
].join(", ")

const PRINT_CSS = `
@page { size: letter; margin: 1in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ${PRINT_FONT_STACK};
  font-size: 11pt;
  line-height: 1.15;
  color: #202124;
  overflow-wrap: break-word;
  word-break: break-word;
}
p { margin: 0 0 7.5pt; orphans: 2; widows: 2; }
h1 { font-size: 20pt; font-weight: 400; color: #3c4043; margin: 16pt 0 6.5pt; line-height: 1.15; page-break-after: avoid; }
h2 { font-size: 16pt; font-weight: 400; color: #3c4043; margin: 14pt 0 5pt; line-height: 1.15; page-break-after: avoid; }
h3 { font-size: 14pt; font-weight: 400; color: #434343; margin: 12pt 0 4pt; line-height: 1.15; page-break-after: avoid; }
h4, h5, h6 { font-size: 12pt; font-weight: 700; color: #434343; margin: 11pt 0 3.5pt; line-height: 1.15; page-break-after: avoid; }
ul { list-style: disc outside; padding-left: 40px; margin: 8pt 0; }
ol { list-style: decimal outside; padding-left: 40px; margin: 8pt 0; }
ul ul, ol ul { list-style: circle outside; }
ul ol, ol ol { list-style: lower-alpha outside; }
li { margin: 2.5pt 0; }
blockquote {
  border-left: 3px solid #d9d7d2;
  margin: 8pt 0;
  padding: 4pt 0 4pt 16pt;
  color: #6d6a64;
  overflow-wrap: break-word;
  page-break-inside: avoid;
}
a { color: #0b6b62; text-decoration: underline; overflow-wrap: anywhere; }
img { max-width: 100%; height: auto; page-break-inside: avoid; }
hr { border: 0; border-top: 1px solid #dadce0; margin: 12pt 0; }
table { border-collapse: collapse; margin: 8pt 0; width: auto; max-width: 100%; page-break-inside: auto; }
td, th { border: 1px solid #b7b7b7; padding: 5pt 6pt; vertical-align: top; overflow-wrap: break-word; }
th { background: #f3f3f3; font-weight: 700; }
pre {
  font-family: ${MONO_FONT_STACK};
  font-size: 10pt;
  background: #f8f9fa;
  border: 1px solid #e8eaed;
  border-radius: 4pt;
  padding: 6pt 8pt;
  margin: 8pt 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  page-break-inside: avoid;
}
code {
  font-family: ${MONO_FONT_STACK};
  font-size: 10pt;
  background: #f1f3f4;
  padding: 0.5pt 2pt;
  border-radius: 2pt;
}
pre code { background: none; padding: 0; }
s, strike, del { text-decoration: line-through; }
figure { margin: 8pt 0; }
figcaption { color: #5f6368; font-size: 9.5pt; text-align: center; margin-top: 4pt; }
`

export function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Build a complete standalone HTML document for export/print. */
export function buildPrintDocument(opts: { title: string; bodyHtml: string; mode: PrintDocMode }): string {
  const titleHtml = escapeHtmlText(opts.title || "Untitled document")
  const wordAttrs =
    opts.mode === "word"
      ? ` xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"`
      : ""
  const wordMeta =
    opts.mode === "word"
      ? `<meta name="ProgId" content="Word.Document"><meta name="Generator" content="Z-Docs">`
      : `<meta name="generator" content="Z-Docs">`
  return `<!DOCTYPE html>
<html lang="zh-CN"${wordAttrs}>
<head><meta charset="utf-8">${wordMeta}<title>${titleHtml}</title>
<style>${PRINT_CSS}
@media print { html, body { width: 8.5in; } }
</style></head>
<body>${opts.bodyHtml}</body></html>`
}

/** Export-safe filename: keep letters/digits/CJK/hyphen/space, cap length. */
export function exportSafeName(title: string, fallback = "document"): string {
  const clean = (title || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/[^\w\d\-()\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
  return clean || fallback
}
