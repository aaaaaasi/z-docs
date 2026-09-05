import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { guardRoute } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** QUOTA is the workspace plan limit — usage below is always REAL measured bytes. */
export const STORAGE_QUOTA_BYTES = 15 * 1024 * 1024 * 1024 // 15 GB

function len(...vals: (string | null | undefined)[]): number {
  return vals.reduce((n, v) => n + (v ? v.length : 0), 0)
}

// GET /api/storage — real byte usage computed from the database
export async function GET(req: NextRequest) {
  const g = await guardRoute(req, { limit: 120, windowMs: 60_000 })
  if (!g.ok) return g.response

  const [documents, versions, sheets, decks, forms, responses, comments, folders, tags] = await Promise.all([
    db.document.findMany({ select: { title: true, content: true, stats: true } }),
    db.documentVersion.findMany({ select: { title: true, content: true } }),
    db.sheet.findMany({ select: { title: true, data: true } }),
    db.slideDeck.findMany({ select: { title: true, data: true } }),
    db.form.findMany({ select: { title: true, description: true, data: true } }),
    db.formResponse.findMany({ select: { answers: true } }),
    db.comment.findMany({ select: { content: true, authorName: true, quote: true } }),
    db.folder.findMany({ select: { name: true } }),
    db.tag.findMany({ select: { name: true } }),
  ])

  const breakdown = {
    documents: documents.reduce((n, d) => n + len(d.title, d.content, d.stats), 0),
    versions: versions.reduce((n, v) => n + len(v.title, v.content), 0),
    sheets: sheets.reduce((n, s) => n + len(s.title, s.data), 0),
    slides: decks.reduce((n, d) => n + len(d.title, d.data), 0),
    forms: forms.reduce((n, f) => n + len(f.title, f.description, f.data), 0),
    responses: responses.reduce((n, r) => n + len(r.answers), 0),
    comments: comments.reduce((n, c) => n + len(c.content, c.authorName, c.quote), 0),
    other: folders.reduce((n, f) => n + len(f.name), 0) + tags.reduce((n, t) => n + len(t.name), 0),
  }

  const usedBytes = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const counts = {
    documents: documents.length,
    versions: versions.length,
    sheets: sheets.length,
    slides: decks.length,
    forms: forms.length,
    responses: responses.length,
    comments: comments.length,
  }

  return Response.json({
    usedBytes,
    quotaBytes: STORAGE_QUOTA_BYTES,
    breakdown,
    counts,
  })
}
