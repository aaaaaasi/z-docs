/**
 * Z-Slides — client-side PPTX export.
 *
 * Maps a DeckData payload (layouts, theme accent, serif/sans font, speaker
 * notes) onto a real Office Open XML .pptx via pptxgenjs, mirroring the
 * on-screen slide geometry (960×540 logical canvas → 10×5.625in LAYOUT_16x9).
 *
 * pptxgenjs is imported dynamically so it stays out of the initial bundle.
 */

import type PptxGenJS from "pptxgenjs"
import type { DeckData, Slide } from "@/lib/workspace-types"

type Pptx = InstanceType<typeof PptxGenJS>
type PptxSlide = PptxGenJS.Slide

/** PPTX text colors (no leading #) aligned with the Tailwind neutral ink ramp. */
const INK = "262626" // neutral-800 — headings
const BODY = "404040" // neutral-700 — body text
const SUBTLE = "737373" // neutral-500 — subtitles
const FAINT = "a3a3a3" // neutral-400 — captions / attributions

/** "RRGGBB" from "#rrggbb" (falls back to a neutral ink). */
function hex6(hex: string | undefined): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex ?? "")
  return m ? m[1] : INK
}

/**
 * Split a two-column body on a line that contains only dashes.
 * Kept in sync with splitColumns() in slides/slide-render.tsx (not imported
 * from there to avoid pulling the React render tree into this module).
 */
function splitColumns(body: string): [string[], string[]] {
  const lines = body.split("\n")
  const idx = lines.findIndex((l) => l.trim() === "---")
  if (idx < 0) return [lines, []]
  return [lines.slice(0, idx), lines.slice(idx + 1)]
}

/** Async-revoked blob download (Safari/headless-safe, same as Z-Docs export). */
function saveBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke asynchronously: some browsers (Safari, headless) start the download
  // after the current task — a synchronous revoke can kill the transfer.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Run list for a bulleted block: one run per non-empty line. */
function bulletRuns(lines: string[]) {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => ({ text, options: { bullet: true, breakLine: true } }))
}

/** Geometry options for a placed text block. */
interface TextBoxOpts {
  x: number
  y: number
  w: number
  h: number
  fontSize: number
  color: string
  align?: "left" | "center" | "right"
  italic?: boolean
  lineSpacing?: number
}

interface RenderTools {
  addText: (slide: PptxSlide, text: string, o: TextBoxOpts) => void
  addBullets: (slide: PptxSlide, lines: string[], o: Omit<TextBoxOpts, "align" | "italic" | "lineSpacing">) => void
  addAccentBar: (slide: PptxSlide, x: number, y: number, w?: number, h?: number) => void
  accent: string
}

/** Build and download a .pptx for the given deck. Throws on failure.
 *  `onProgress` receives 0–100 while slides are assembled (export card). */
export async function exportDeckToPptx(
  title: string,
  data: DeckData,
  onProgress?: (percent: number) => void
): Promise<string> {
  const { default: PptxGenJS } = await import("pptxgenjs")
  const pptx = new PptxGenJS()
  pptx.layout = "LAYOUT_16x9"
  pptx.title = title
  pptx.author = "Z-Docs"
  pptx.company = "Z-Docs"

  const accent = hex6(data.theme?.accent)
  const fontFace = data.theme?.font === "serif" ? "Georgia" : "Arial"

  const addText = (slide: PptxSlide, text: string, o: TextBoxOpts) => {
    slide.addText(text, {
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      fontSize: o.fontSize,
      color: o.color,
      align: o.align ?? "left",
      italic: o.italic ?? false,
      lineSpacingMultiple: o.lineSpacing,
      fontFace,
      valign: "top",
    })
  }

  const addBullets = (
    slide: PptxSlide,
    lines: string[],
    o: Omit<TextBoxOpts, "align" | "italic" | "lineSpacing">
  ) => {
    const runs = bulletRuns(lines)
    if (runs.length === 0) return
    slide.addText(runs, {
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      fontSize: o.fontSize,
      color: o.color,
      fontFace,
      valign: "top",
      lineSpacingMultiple: 1.35,
      paraSpaceAfter: 6,
    })
  }

  /** The short accent underline bar shown under titles. */
  const addAccentBar = (slide: PptxSlide, x: number, y: number, w = 0.55, h = 0.05) => {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w,
      h,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    })
  }

  const slides = data.slides
  for (let si = 0; si < slides.length; si++) {
    const s = slides[si]
    onProgress?.(Math.round(((si + 1) / Math.max(1, slides.length)) * 90))
    const slide = pptx.addSlide()
    if (s.notes && s.notes.trim()) slide.addNotes(s.notes.trim())
    renderSlide(s, slide, { addText, addBullets, addAccentBar, accent })
  }

  onProgress?.(95)
  const blob = (await pptx.write({ outputType: "blob" })) as Blob
  onProgress?.(100)

  const safeName =
    (title.trim() || "presentation").replace(/[\\/:*?"<>|]/g, "_").slice(0, 100) || "presentation"
  const filename = `${safeName}.pptx`
  saveBlobFile(blob, filename)
  return filename
}

/** Per-layout geometry, mirroring slides/slide-render.tsx proportions. */
function renderSlide(s: Slide, slide: PptxSlide, tools: RenderTools) {
  switch (s.layout) {
    case "title": {
      tools.addText(slide, s.title, {
        x: 1.5, y: 1.95, w: 7, h: 1.15,
        fontSize: 40, color: INK, align: "center", lineSpacing: 1.14,
      })
      tools.addText(slide, s.body, {
        x: 2.1, y: 3.2, w: 5.8, h: 0.85,
        fontSize: 18, color: SUBTLE, align: "center", lineSpacing: 1.5,
      })
      break
    }
    case "titleBody": {
      tools.addText(slide, s.title, {
        x: 0.83, y: 0.55, w: 8.34, h: 0.85,
        fontSize: 30, color: INK, lineSpacing: 1.18,
      })
      tools.addAccentBar(slide, 0.83, 1.52)
      tools.addBullets(slide, s.body.split("\n"), {
        x: 0.83, y: 1.85, w: 8.34, h: 2.9,
        fontSize: 16, color: BODY,
      })
      break
    }
    case "twoColumn": {
      tools.addText(slide, s.title, {
        x: 0.83, y: 0.55, w: 8.34, h: 0.85,
        fontSize: 29, color: INK, lineSpacing: 1.18,
      })
      tools.addAccentBar(slide, 0.83, 1.52)
      const [left, right] = splitColumns(s.body)
      tools.addBullets(slide, left, {
        x: 0.83, y: 1.85, w: 3.95, h: 2.9,
        fontSize: 15, color: BODY,
      })
      tools.addBullets(slide, right, {
        x: 5.22, y: 1.85, w: 3.95, h: 2.9,
        fontSize: 15, color: BODY,
      })
      break
    }
    case "quote": {
      const lines = s.body.split("\n")
      const quote = lines[0] ?? ""
      const attribution = lines[1] ?? ""
      // decorative oversized quotation mark
      tools.addText(slide, "\u201C", {
        x: 4.2, y: 0.85, w: 1.6, h: 1.3,
        fontSize: 66, color: tools.accent, align: "center",
      })
      tools.addText(slide, quote, {
        x: 1.8, y: 2.15, w: 6.4, h: 1.5,
        fontSize: 24, color: INK, align: "center", italic: true, lineSpacing: 1.45,
      })
      if (attribution) {
        tools.addText(slide, `— ${attribution}`, {
          x: 2.5, y: 3.85, w: 5, h: 0.55,
          fontSize: 14, color: FAINT, align: "center",
        })
      }
      break
    }
    case "section": {
      tools.addAccentBar(slide, 10 / 2 - 0.25, 2.0, 0.5, 0.045)
      tools.addText(slide, s.title, {
        x: 1.2, y: 2.3, w: 7.6, h: 1.3,
        fontSize: 36, color: INK, align: "center", lineSpacing: 1.12,
      })
      tools.addText(slide, s.body, {
        x: 2.3, y: 3.75, w: 5.4, h: 0.75,
        fontSize: 16, color: FAINT, align: "center", lineSpacing: 1.5,
      })
      break
    }
    case "blank":
    default: {
      tools.addText(slide, s.body, {
        x: 1.0, y: 2.2, w: 8, h: 1.25,
        fontSize: 18, color: BODY, lineSpacing: 1.55,
      })
      break
    }
  }
}
