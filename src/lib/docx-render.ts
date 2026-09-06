import { Parser } from "htmlparser2"
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

/**
 * HTML → real .docx converter (server-side).
 *
 * Walks the editor's document HTML (TipTap output: p/h1-h6/ul/ol/li/
 * blockquote/pre/code/table/a/b/i/u/s/img/hr) and emits a genuine Office
 * Open XML package — paragraphs, heading styles, real bullets & numbering,
 * quote borders, code shading, bordered tables, hyperlinks and embedded
 * images (data URLs with sniffered dimensions).
 */

type El = {
  type: "el"
  tag: string
  attrs: Record<string, string>
  children: DomNode[]
}
type TextNode = { type: "text"; text: string }
type DomNode = El | TextNode

const SKIP_TAGS = new Set(["script", "style", "meta", "link", "head", "title"])

function parseHtml(html: string): El {
  const root: El = { type: "el", tag: "body", attrs: {}, children: [] }
  const stack: El[] = [root]
  const parser = new Parser(
    {
      onopentag(tag, attrs) {
        if (SKIP_TAGS.has(tag)) return
        const el: El = { type: "el", tag, attrs, children: [] }
        stack[stack.length - 1].children.push(el)
        stack.push(el)
      },
      onclosetag(tag) {
        if (SKIP_TAGS.has(tag)) return
        for (let i = stack.length - 1; i > 0; i--) {
          const top = stack.pop()
          if (top && top.tag === tag) break
        }
      },
      ontext(text) {
        stack[stack.length - 1].children.push({ type: "text", text } as TextNode)
      },
    },
    { decodeEntities: true },
  )
  parser.write(html)
  parser.end()
  return root
}

/* ------------------------- inline style helpers ------------------------- */

function styleMap(el: El): Record<string, string> {
  const out: Record<string, string> = {}
  const raw = el.attrs["style"] || ""
  for (const part of raw.split(";")) {
    const idx = part.indexOf(":")
    if (idx < 0) continue
    const k = part.slice(0, idx).trim().toLowerCase()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = v
  }
  return out
}

function alignOf(el: El): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const s = styleMap(el)
  const raw = (s["text-align"] || el.attrs["align"] || "").toLowerCase()
  if (raw.includes("center")) return AlignmentType.CENTER
  if (raw.includes("right")) return AlignmentType.RIGHT
  if (raw.includes("justify") || raw.includes("full")) return AlignmentType.JUSTIFIED
  return undefined
}

/** pt string ("14pt") or px → docx half-points number */
function runSize(el: El): number | undefined {
  const s = styleMap(el)
  const fs = s["font-size"] || ""
  const pt = /^([\d.]+)pt$/i.exec(fs)
  if (pt) return Math.round(parseFloat(pt[1]) * 2)
  const px = /^([\d.]+)px$/i.exec(fs)
  if (px) return Math.round(parseFloat(px[1]) * 0.75 * 2)
  return undefined
}

function runFont(el: El): string | undefined {
  const s = styleMap(el)
  const raw = s["font-family"] || ""
  if (!raw) return undefined
  const first = raw.split(",")[0].replace(/["']/g, "").trim()
  return first || undefined
}

function colorOf(el: El): string | undefined {
  const s = styleMap(el)
  const raw = (s["color"] || "").trim()
  if (!raw) return undefined
  const hex6 = /^#([0-9a-f]{6})$/i.exec(raw)
  if (hex6) return hex6[1].toUpperCase()
  const hex3 = /^#([0-9a-f]{3})$/i.exec(raw)
  if (hex3) return hex3[1].split("").map((c) => c + c).join("").toUpperCase()
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(raw)
  if (rgb) {
    const h = (n: number) => Math.max(0, Math.min(255, Number(rgb[n]))).toString(16).padStart(2, "0")
    return `${h(1)}${h(2)}${h(3)}`.toUpperCase()
  }
  return undefined
}

/* ------------------------------ image sniff ------------------------------ */

function sniffImageSize(buf: Buffer, mime: string): { width: number; height: number } | null {
  try {
    if (mime === "image/png" && buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    if (mime === "image/gif" && buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
    }
    if (mime === "image/jpeg") {
      let off = 2
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) {
          off++
          continue
        }
        const marker = buf[off + 1]
        const len = buf.readUInt16BE(off + 2)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) }
        }
        off += 2 + len
      }
    }
    if (mime === "image/webp" && buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF") {
      const chunk = buf.toString("ascii", 12, 16)
      if (chunk === "VP8 ") {
        const w = buf.readUInt16LE(26) & 0x3fff
        const h = buf.readUInt16LE(28) & 0x3fff
        return { width: w, height: h }
      }
      if (chunk === "VP8X") {
        const w = 1 + ((buf[24] | (buf[25] << 8) | (buf[26] << 16)) & 0xffffff)
        const h = 1 + ((buf[27] | (buf[28] << 8) | (buf[29] << 16)) & 0xffffff)
        return { width: w, height: h }
      }
      if (chunk === "VP8L") {
        const b = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24)
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
      }
    }
  } catch {
    /* fallthrough */
  }
  return null
}

/** page-fit transformation for ImageRun (px @96dpi; content width 6.5in) */
const MAX_W = 624
const MAX_H = 936

type ImgType = "png" | "jpg" | "gif"

function dataUrlImage(src: string): ImageRun | null {
  const m = /^data:(image\/(?:png|jpe?g|gif));base64,([\s\S]+)$/i.exec(src.trim())
  if (!m) return null
  try {
    const mime = m[1].toLowerCase().replace("image/jpe", "image/jpeg")
    const buf = Buffer.from(m[2], "base64")
    if (buf.length < 64 || buf.length > 6 * 1024 * 1024) return null
    const size = sniffImageSize(buf, mime)
    if (!size || size.width < 2 || size.height < 2) return null
    let { width, height } = size
    const scale = Math.min(MAX_W / width, MAX_H / height, 1)
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
    const type: ImgType = mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : "jpg"
    return new ImageRun({ data: buf, transformation: { width, height }, type })
  } catch {
    return null
  }
}

/* ------------------------------ inline runs ------------------------------ */

type RunFmt = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean; font?: string; size?: number; color?: string; code?: boolean }

function runsFrom(nodes: DomNode[], fmt: RunFmt): Array<TextRun | ExternalHyperlink | ImageRun> {
  const out: Array<TextRun | ExternalHyperlink | ImageRun> = []
  const pushText = (text: string, f: RunFmt) => {
    if (!text) return
    out.push(
      new TextRun({
        text,
        bold: f.bold,
        italics: f.italics,
        underline: f.underline ? {} : undefined,
        strike: f.strike,
        font: f.code ? "Courier New" : f.font,
        size: f.size,
        color: f.color ?? (f.code ? "202124" : undefined),
      }),
    )
  }
  for (const node of nodes) {
    if (node.type === "text") {
      pushText(node.text.replace(/[ \t\r\n]+/g, " "), fmt)
      continue
    }
    const tag = node.tag
    switch (tag) {
      case "br":
        out.push(new TextRun({ break: 1 }))
        break
      case "b": case "strong":
        out.push(...runsFrom(node.children, { ...fmt, bold: true }))
        break
      case "i": case "em":
        out.push(...runsFrom(node.children, { ...fmt, italics: true }))
        break
      case "u":
        out.push(...runsFrom(node.children, { ...fmt, underline: true }))
        break
      case "s": case "strike": case "del":
        out.push(...runsFrom(node.children, { ...fmt, strike: true }))
        break
      case "code":
        out.push(...runsFrom(node.children, { ...fmt, code: true }))
        break
      case "sub": case "sup":
        // subscript/superscript formatting is rare in doc bodies; keep the text
        out.push(...runsFrom(node.children, fmt))
        break
      case "a": {
        const href = node.attrs["href"] || ""
        const text = flattenText(node.children)
        if (/^https?:\/\//i.test(href) && text) {
          out.push(
            new ExternalHyperlink({
              link: href,
              children: [new TextRun({ text, style: "Hyperlink", bold: fmt.bold, italics: fmt.italics, size: fmt.size })],
            }),
          )
        } else if (text) {
          pushText(text, fmt)
        }
        break
      }
      case "img": {
        const img = dataUrlImage(node.attrs["src"] || "")
        if (img) out.push(img)
        else {
          const alt = (node.attrs["alt"] || "").trim()
          if (alt) pushText(`[ ${alt} ]`, { ...fmt, italics: true })
        }
        break
      }
      case "span": case "font": {
        const merged: RunFmt = { ...fmt }
        const size = runSize(node)
        if (size) merged.size = size
        const font = runFont(node)
        if (font) merged.font = font
        const color = colorOf(node)
        if (color) merged.color = color
        out.push(...runsFrom(node.children, merged))
        break
      }
      default:
        if (node.children.length) out.push(...runsFrom(node.children, fmt))
        break
    }
  }
  return out
}

function flattenText(nodes: DomNode[]): string {
  let s = ""
  for (const n of nodes) {
    if (n.type === "text") s += n.text
    else {
      if (n.tag === "br") s += " "
      else s += flattenText(n.children)
    }
  }
  return s.replace(/\s+/g, " ").trim()
}

/* ------------------------------ block walker ------------------------------ */

const HEADING_MAP: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
}

const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "B7B7B7" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "B7B7B7" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "B7B7B7" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "B7B7B7" },
}

function docxTable(el: El): Table {
  const rows: TableRow[] = []
  for (const tr of descendantsWithTag(el, "tr")) {
    const cells: TableCell[] = []
    for (const cell of tr.children.filter((c): c is El => c.type === "el" && /^(td|th)$/.test(c.tag))) {
      const isHeader = cell.tag === "th"
      const paras: Paragraph[] = []
      const blockCells = cell.children.filter((c): c is El => c.type === "el" && /^p$/.test(c.tag))
      if (blockCells.length > 0) {
        for (const p of blockCells) {
          paras.push(new Paragraph({ children: runsFrom(p.children, { bold: isHeader }), spacing: { after: 40 } }))
        }
      } else {
        const inline = runsFrom(cell.children, { bold: isHeader })
        paras.push(new Paragraph({ children: inline.length ? inline : [new TextRun({ text: "" })], spacing: { after: 40 } }))
      }
      cells.push(new TableCell({ children: paras, borders: CELL_BORDERS, shading: isHeader ? { type: ShadingType.CLEAR, fill: "F3F3F3" } : undefined }))
    }
    if (cells.length) rows.push(new TableRow({ children: cells }))
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

function descendantsWithTag(el: El, tag: string): El[] {
  const out: El[] = []
  const walk = (n: DomNode) => {
    if (n.type === "text") return
    if (n.tag === tag) {
      out.push(n)
      return
    }
    n.children.forEach(walk)
  }
  el.children.forEach(walk)
  return out
}

function listParagraphs(el: El, level: number, olInstance: { n: number }): Paragraph[] {
  const out: Paragraph[] = []
  const ordered = el.tag === "ol"
  for (const li of el.children.filter((c): c is El => c.type === "el" && c.tag === "li")) {
    const nested: El[] = []
    const inlineNodes: DomNode[] = []
    for (const ch of li.children) {
      if (ch.type === "el" && (ch.tag === "ul" || ch.tag === "ol")) {
        nested.push(ch)
      } else {
        inlineNodes.push(ch)
      }
    }
    // keep list-marker attached to the first line; empty items keep a marker
    const runs = runsFrom(inlineNodes, {})
    const liParagraph = ordered
      ? new Paragraph({
          children: runs.length ? runs : [new TextRun({ text: "" })],
          numbering: { reference: "z-ol", level, instance: olInstance.n },
        })
      : new Paragraph({ children: runs.length ? runs : [new TextRun({ text: "" })], bullet: { level } })
    out.push(liParagraph)
    for (const nl of nested) out.push(...listParagraphs(nl, Math.min(level + 1, 4), ordered ? { n: ++olInstance.n } : olInstance))
  }
  return out
}

function quoteParagraphs(el: El): Paragraph[] {
  const paras: Paragraph[] = []
  const inner = el.children.filter((c): c is El => c.type === "el" && c.tag === "p")
  if (inner.length > 0) {
    for (const p of inner) {
      paras.push(new Paragraph({ children: runsFrom(p.children, { color: "6D6A64" }), style: "ZQuote" }))
    }
  } else {
    const runs = runsFrom(el.children, { color: "6D6A64" })
    if (runs.length) paras.push(new Paragraph({ children: runs, style: "ZQuote" }))
  }
  return paras.length ? paras : [new Paragraph({ children: [new TextRun({ text: "" })], style: "ZQuote" })]
}

function preParagraphs(el: El): Paragraph[] {
  const text = flattenPreText(el)
  const lines = text.split("\n")
  return lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line || "", font: "Courier New", size: 20 })],
        style: "ZCode",
      }),
  )
}

function flattenPreText(el: El): string {
  let s = ""
  const walk = (n: DomNode) => {
    if (n.type === "text") s += n.text
    else if (n.tag === "br") s += "\n"
    else n.children.forEach(walk)
  }
  el.children.forEach(walk)
  return s.replace(/\n$/, "")
}

function imageParagraph(el: El): Paragraph | null {
  const img = dataUrlImage(el.attrs["src"] || "")
  if (!img) {
    const alt = (el.attrs["alt"] || "").trim()
    if (!alt) return null
    return new Paragraph({ children: [new TextRun({ text: `[ ${alt} ]`, italics: true, color: "5F6368" })], alignment: AlignmentType.CENTER })
  }
  return new Paragraph({ children: [img], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 } })
}

function blocksFrom(nodes: DomNode[], olInstance: { n: number }): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = []
  for (const node of nodes) {
    if (node.type === "text") {
      const t = node.text.trim()
      if (t) out.push(new Paragraph({ children: runsFrom([{ type: "text", text: t }], {}) }))
      continue
    }
    const el = node
    switch (el.tag) {
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
        const runs = runsFrom(el.children, {})
        out.push(
          new Paragraph({
            children: runs.length ? runs : [new TextRun({ text: "" })],
            heading: HEADING_MAP[el.tag],
            alignment: alignOf(el),
          }),
        )
        break
      }
      case "p": {
        const runs = runsFrom(el.children, {})
        out.push(new Paragraph({ children: runs.length ? runs : [new TextRun({ text: "" })], alignment: alignOf(el), spacing: { after: 150 } }))
        break
      }
      case "ul": case "ol":
        out.push(...listParagraphs(el, 0, olInstance))
        break
      case "blockquote":
        out.push(...quoteParagraphs(el))
        break
      case "pre":
        out.push(...preParagraphs(el))
        break
      case "table":
        out.push(docxTable(el))
        out.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 60 } }))
        break
      case "hr":
        out.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DADCE0", space: 1 } },
            spacing: { before: 240, after: 240 },
            children: [new TextRun({ text: "" })],
          }),
        )
        break
      case "img": {
        const p = imageParagraph(el)
        if (p) out.push(p)
        break
      }
      case "figure": {
        for (const ch of el.children) {
          if (ch.type === "el" && ch.tag === "img") {
            const p = imageParagraph(ch)
            if (p) out.push(p)
          } else if (ch.type === "el" && ch.tag === "figcaption") {
            const cap = flattenText(ch.children)
            if (cap) out.push(new Paragraph({ children: [new TextRun({ text: cap, color: "5F6368", size: 19 })], alignment: AlignmentType.CENTER }))
          }
        }
        break
      }
      case "br":
        out.push(new Paragraph({ children: [new TextRun({ text: "" })] }))
        break
      default:
        if (el.children.length) out.push(...blocksFrom(el.children, olInstance))
        break
    }
  }
  return out
}

/* ------------------------------ document ------------------------------ */

export async function htmlToDocx(title: string, bodyHtml: string): Promise<Buffer> {
  const root = parseHtml(bodyHtml)
  const children = blocksFrom(root.children, { n: 1 })
  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }))
  }

  const doc = new Document({
    title: title || "Untitled document",
    creator: "Z-Docs",
    styles: {
      default: {
        document: { run: { font: "Arial", size: 22 }, paragraph: { spacing: { line: 276 } } },
      },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 40, color: "3C4043", bold: false },
          paragraph: { spacing: { before: 320, after: 130 } },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, color: "3C4043", bold: false },
          paragraph: { spacing: { before: 280, after: 100 } },
        },
        {
          id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, color: "434343", bold: false },
          paragraph: { spacing: { before: 240, after: 80 } },
        },
        {
          id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, color: "434343", bold: true },
          paragraph: { spacing: { before: 220, after: 70 } },
        },
        {
          id: "ZQuote", name: "Z Quote", basedOn: "Normal", next: "Normal",
          run: { color: "6D6A64" },
          paragraph: {
            indent: { left: 360 },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: "D9D7D2", space: 8 } },
            spacing: { before: 160, after: 160 },
          },
        },
        {
          id: "ZCode", name: "Z Code", basedOn: "Normal", next: "Normal",
          run: { font: "Courier New", size: 20 },
          paragraph: {
            spacing: { before: 40, after: 40 },
            shading: { type: ShadingType.CLEAR, fill: "F8F9FA" },
          },
        },
      ],
      characterStyles: [
        { id: "Hyperlink", name: "Hyperlink", basedOn: "DefaultParagraphFont", run: { color: "0B6B62", underline: { type: "single" } } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "z-ol",
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: "decimal" as const,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  })
  return Packer.toBuffer(doc) as unknown as Promise<Buffer>
}
