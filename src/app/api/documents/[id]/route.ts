import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actorFromRequest, logActivity, logActivityThrottled } from "@/lib/server-activity"
import { sanitizeDocHtml, guardRoute, docAccessLevel, hasAccess, notFound, forbidden } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const VERSION_INTERVAL_MS = 5 * 60 * 1000 // snapshot at most every 5 minutes
const MAX_VERSIONS = 20

function serialize(doc: {
  id: string
  title: string
  content: string
  starred: boolean
  trashed: boolean
  folderId: string | null
  stats: string
  editCount: number
  createdAt: Date
  updatedAt: Date
  /** present when fetched with the tags include */
  tags?: { tag: { id: string; name: string; color: string } }[]
}) {
  let parsedStats: Record<string, unknown> = {}
  try {
    if (doc.stats) parsedStats = JSON.parse(doc.stats)
  } catch {
    parsedStats = {}
  }
  return {
    ...doc,
    stats: parsedStats,
    tags: [...(doc.tags ?? [])]
      .map((dt) => ({ id: dt.tag.id, name: dt.tag.name, color: dt.tag.color }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

/** Snapshot the pre-update state (rate-limited) to build version history */
async function maybeSnapshot(docId: string, oldTitle: string, oldContent: string) {
  try {
    const latest = await db.documentVersion.findFirst({
      where: { docId },
      orderBy: { createdAt: "desc" },
    })
    const due = !latest || Date.now() - latest.createdAt.getTime() > VERSION_INTERVAL_MS
    if (!due) return
    await db.documentVersion.create({
      data: { docId, title: oldTitle, content: oldContent },
    })
    // cap stored versions
    const count = await db.documentVersion.count({ where: { docId } })
    if (count > MAX_VERSIONS) {
      const stale = await db.documentVersion.findMany({
        where: { docId },
        orderBy: { createdAt: "desc" },
        skip: MAX_VERSIONS,
        take: count - MAX_VERSIONS,
        select: { id: true },
      })
      if (stale.length > 0) {
        await db.documentVersion.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
      }
    }
  } catch (e) {
    console.error("snapshot failed:", e)
  }
}

// GET /api/documents/:id — 404 when the caller has no access (existence hidden)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await guardRoute(req)
    if (!guard.ok) return guard.response
    const level = await docAccessLevel(guard.user, id)
    if (!hasAccess(level, "viewer")) return notFound()

    const doc = await db.document.findUnique({
      where: { id },
      include: {
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
    })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ document: serialize(doc) })
  } catch (e) {
    console.error("GET /api/documents/[id] failed:", e)
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 })
  }
}

// PATCH /api/documents/:id { title?, content?, starred?, trashed?, folderId? } — editor+
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await guardRoute(req, { mutating: true, limit: 60 })
    if (!guard.ok) return guard.response
    const level = await docAccessLevel(guard.user, id)
    if (level === "none") return notFound()
    if (!hasAccess(level, "editor")) return forbidden()

    const body = (await req.json().catch(() => ({}))) as {
      title?: string
      content?: string
      starred?: boolean
      trashed?: boolean
      folderId?: string | null
    }

    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data: { title?: string; content?: string; starred?: boolean; trashed?: boolean; folderId?: string | null; editCount?: number } = {}
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 150)
    if (typeof body.content === "string") data.content = sanitizeDocHtml(body.content.slice(0, 5 * 1024 * 1024))
    if (typeof body.starred === "boolean") data.starred = body.starred
    if (typeof body.trashed === "boolean") data.trashed = body.trashed
    if (body.folderId === null || typeof body.folderId === "string") {
      if (body.folderId === null || body.folderId === "" || body.folderId === "root") {
        data.folderId = null
      } else {
        const folder = await db.folder.findUnique({ where: { id: body.folderId }, select: { id: true } })
        if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 400 })
        data.folderId = body.folderId
      }
    }

    if (data.content !== undefined && data.content !== doc.content) {
      await maybeSnapshot(id, doc.title, doc.content)
      // every real saved change after the first version bumps the revision counter
      data.editCount = doc.editCount + 1
    }

    const updated = await db.document.update({ where: { id }, data })

    // activity feed attribution (session user wins over headers)
    const actor = await actorFromRequest(req)
    if (data.trashed !== undefined && data.trashed !== doc.trashed) {
      await logActivity({
        app: "docs",
        kind: data.trashed ? "trashed" : "restored",
        entityId: id,
        entityTitle: updated.title,
        actor,
      })
    } else if (data.starred !== undefined && data.starred !== doc.starred) {
      await logActivity({
        app: "docs",
        kind: data.starred ? "starred" : "unstarred",
        entityId: id,
        entityTitle: updated.title,
        actor,
      })
    } else if (data.title !== undefined && data.title !== doc.title) {
      await logActivity({
        app: "docs",
        kind: "renamed",
        entityId: id,
        entityTitle: data.title,
        detail: `renamed from “${doc.title}”`,
        actor,
      })
    } else if (data.content !== undefined && data.content !== doc.content) {
      await logActivityThrottled(10, {
        app: "docs",
        kind: "edited",
        entityId: id,
        entityTitle: updated.title,
        actor,
      })
    }

    return NextResponse.json({ document: serialize(updated) })
  } catch (e) {
    console.error("PATCH /api/documents/[id] failed:", e)
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}

// DELETE /api/documents/:id — permanent delete, editor+
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await guardRoute(req, { mutating: true, limit: 60 })
    if (!guard.ok) return guard.response
    const level = await docAccessLevel(guard.user, id)
    if (level === "none") return notFound()
    if (!hasAccess(level, "editor")) return forbidden()

    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.document.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/documents/[id] failed:", e)
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
  }
}
