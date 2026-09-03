import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

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
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...doc,
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

// GET /api/documents/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ document: serialize(doc) })
  } catch (e) {
    console.error("GET /api/documents/[id] failed:", e)
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 })
  }
}

// PATCH /api/documents/:id { title?, content?, starred?, trashed?, folderId? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as {
      title?: string
      content?: string
      starred?: boolean
      trashed?: boolean
      folderId?: string | null
    }

    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data: { title?: string; content?: string; starred?: boolean; trashed?: boolean; folderId?: string | null } = {}
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 150)
    if (typeof body.content === "string") data.content = body.content.slice(0, 5 * 1024 * 1024)
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
    }

    const updated = await db.document.update({ where: { id }, data })
    return NextResponse.json({ document: serialize(updated) })
  } catch (e) {
    console.error("PATCH /api/documents/[id] failed:", e)
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}

// DELETE /api/documents/:id — permanent delete
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.document.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/documents/[id] failed:", e)
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
  }
}
