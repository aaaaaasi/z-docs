import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { guardRoute } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** Workspace plan limit, ONLY if the operator sets STORAGE_QUOTA_GB.
 * Zero (default) = unknown — the UI shows the real measured usage and never
 * fabricates a "total". Usage below is always REAL bytes from the database. */
export const STORAGE_QUOTA_BYTES = (() => {
  const gb = Number(process.env.STORAGE_QUOTA_GB ?? 0)
  return Number.isFinite(gb) && gb > 0 ? Math.floor(gb * 1024 ** 3) : 0
})()

function len(...vals: (string | null | undefined)[]): number {
  return vals.reduce((n, v) => n + (v ? v.length : 0), 0)
}

// GET /api/storage — the caller's real byte usage computed from the database
// (per-user: only their own documents, sheets, decks, forms, comments…)
export async function GET(req: NextRequest) {
  const g = await guardRoute(req, { limit: 120, windowMs: 60_000 })
  if (!g.ok) return g.response
  const me = g.user

  const [documents, versions, sheets, decks, forms, responses, comments, folders, tags] = await Promise.all([
    db.document.findMany({ where: { ownerId: me.id }, select: { title: true, content: true, stats: true } }),
    db.documentVersion.findMany({ where: { doc: { ownerId: me.id } }, select: { title: true, content: true } }),
    db.sheet.findMany({ where: { ownerId: me.id }, select: { title: true, data: true } }),
    db.slideDeck.findMany({ where: { ownerId: me.id }, select: { title: true, data: true } }),
    db.form.findMany({ where: { ownerId: me.id }, select: { title: true, description: true, data: true } }),
    db.formResponse.findMany({ where: { form: { ownerId: me.id } }, select: { answers: true } }),
    db.comment.findMany({ where: { doc: { ownerId: me.id } }, select: { content: true, authorName: true, quote: true } }),
    db.folder.findMany({ where: { ownerId: me.id }, select: { name: true } }),
    db.tag.findMany({ where: { ownerId: me.id }, select: { name: true } }),
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
    folders: folders.length,
    tags: tags.length,
  }

  return Response.json({
    usedBytes,
    quotaBytes: STORAGE_QUOTA_BYTES,
    breakdown,
    counts,
  })
}
