import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, isSameOrigin, rateLimit, clientIp, tooManyRequests, sanitizeDocHtml } from "@/lib/server-auth"
import { buildPrintDocument, exportSafeName, escapeHtmlText } from "@/lib/print-html"
import { renderHtmlToPdf, PdfRenderError } from "@/lib/pdf-render"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** The offline renderer cannot fetch remote images (all hosts are blocked) —
 *  replace them with a styled alt-text placeholder instead of a broken glyph. */
function stripRemoteImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /src\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? ""
    if (/^data:image\//i.test(src)) return tag
    const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.trim() ?? ""
    if (alt) return `<em style="color:#5f6368">[ ${escapeHtmlText(alt)} ]</em>`
    return ""
  })
}

/**
 * POST /api/export/pdf — high-quality VECTOR PDF of the caller's document.
 *
 * Works both signed-in (per-user limit) and as a guest (per-IP limit) so the
 * local-only guest experience still gets real, selectable-text PDFs. The
 * render is one-shot: HTML is sanitized, printed by offline Chromium to a
 * temp file, streamed back, and nothing is persisted.
 *
 * Body: { title?: string, html: string } (document body HTML from the editor).
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 })
    }

    const user = await getSessionUser(req)
    const limitKey = user ? `pdf:${user.id}` : `pdf:${clientIp(req)}`
    const limit = user ? 8 : 4
    if (!rateLimit(limitKey, limit, 60_000)) {
      return tooManyRequests("Too many PDF exports — try again in a minute.")
    }

    const body = (await req.json().catch(() => null)) as { title?: unknown; html?: unknown } | null
    const rawHtml = typeof body?.html === "string" ? body.html : ""
    if (!rawHtml.trim()) {
      return NextResponse.json({ error: "Nothing to export — the document is empty." }, { status: 400 })
    }
    if (rawHtml.length > 2_000_000) {
      return NextResponse.json({ error: "Document is too large to export." }, { status: 413 })
    }
    const title = typeof body?.title === "string" ? body.title.slice(0, 200) : ""

    const html = buildPrintDocument({
      title,
      bodyHtml: stripRemoteImages(sanitizeDocHtml(rawHtml)),
      mode: "print",
    })

    let pdf: Buffer
    try {
      pdf = await renderHtmlToPdf(html)
    } catch (err) {
      const code = err instanceof PdfRenderError ? err.code : "render-failed"
      console.error("POST /api/export/pdf render failed:", code, err)
      return NextResponse.json(
        { error: "PDF renderer is unavailable — try the print dialog instead." },
        { status: 502 },
      )
    }

    const safe = exportSafeName(title)
    const utf8 = encodeURIComponent(`${safe}.pdf`)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safe.replace(/[^\x20-\x7e]/g, "_")}.pdf"; filename*=UTF-8''${utf8}`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (e) {
    console.error("POST /api/export/pdf failed:", e)
    return NextResponse.json({ error: "Failed to export PDF" }, { status: 500 })
  }
}
