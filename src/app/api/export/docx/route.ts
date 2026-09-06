import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, isSameOrigin, rateLimit, clientIp, tooManyRequests, sanitizeDocHtml } from "@/lib/server-auth"
import { exportSafeName } from "@/lib/print-html"
import { htmlToDocx } from "@/lib/docx-render"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/export/docx — a REAL Word .docx (Office Open XML package) of the
 * caller's document: headings, bullets/numbering, quotes, code blocks, tables,
 * hyperlinks and embedded data-URL images.
 *
 * Same access model as the PDF exporter: signed-in (per-user limit) or guest
 * (per-IP limit); transient render, nothing persisted.
 *
 * Body: { title?: string, html: string } (document body HTML from the editor).
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 })
    }

    const user = await getSessionUser(req)
    const limitKey = user ? `docx:${user.id}` : `docx:${clientIp(req)}`
    const limit = user ? 8 : 4
    if (!rateLimit(limitKey, limit, 60_000)) {
      return tooManyRequests("Too many Word exports — try again in a minute.")
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

    const buf = await htmlToDocx(title, sanitizeDocHtml(rawHtml))

    const safe = exportSafeName(title)
    const utf8 = encodeURIComponent(`${safe}.docx`)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safe.replace(/[^\x20-\x7e]/g, "_")}.docx"; filename*=UTF-8''${utf8}`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (e) {
    console.error("POST /api/export/docx failed:", e)
    return NextResponse.json({ error: "Failed to export Word document" }, { status: 500 })
  }
}
