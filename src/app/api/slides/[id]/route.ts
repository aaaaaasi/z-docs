import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actorFromRequest, logActivity, logActivityThrottled } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

function serialize(d: {
  id: string
  title: string
  data: string
  starred: boolean
  trashed: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: d.id,
    title: d.title,
    data: d.data,
    starred: d.starred,
    trashed: d.trashed,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

// GET /api/slides/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const deck = await db.slideDeck.findUnique({ where: { id } })
    if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ deck: serialize(deck) })
  } catch (e) {
    console.error("GET /api/slides/[id] failed:", e)
    return NextResponse.json({ error: "Failed to load deck" }, { status: 500 })
  }
}

// PATCH /api/slides/:id — { title?, data?, starred?, trashed? }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as {
      title?: string
      data?: string
      starred?: boolean
      trashed?: boolean
    }
    const before = await db.slideDeck.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data: { title?: string; data?: string; starred?: boolean; trashed?: boolean } = {}
    if (typeof body.title === "string") data.title = body.title.trim().slice(0, 120) || before.title
    if (typeof body.data === "string") data.data = body.data
    if (typeof body.starred === "boolean") data.starred = body.starred
    if (typeof body.trashed === "boolean") data.trashed = body.trashed

    const deck = await db.slideDeck.update({ where: { id }, data })
    const actor = actorFromRequest(req)

    if (data.trashed !== undefined && data.trashed !== before.trashed) {
      await logActivity({
        app: "slides",
        kind: data.trashed ? "trashed" : "restored",
        entityId: id,
        entityTitle: deck.title,
        actor,
      })
    } else if (data.starred !== undefined && data.starred !== before.starred) {
      await logActivity({
        app: "slides",
        kind: data.starred ? "starred" : "unstarred",
        entityId: id,
        entityTitle: deck.title,
        actor,
      })
    } else if (data.title !== undefined && data.title !== before.title) {
      await logActivity({
        app: "slides",
        kind: "renamed",
        entityId: id,
        entityTitle: data.title,
        detail: `renamed from “${before.title}”`,
        actor,
      })
    } else if (data.data !== undefined && data.data !== before.data) {
      await logActivityThrottled(10, {
        app: "slides",
        kind: "edited",
        entityId: id,
        entityTitle: deck.title,
        detail: "edited slides",
        actor,
      })
    }

    return NextResponse.json({ deck: serialize(deck) })
  } catch (e) {
    console.error("PATCH /api/slides/[id] failed:", e)
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 })
  }
}

// DELETE /api/slides/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const deck = await db.slideDeck.findUnique({ where: { id } })
    if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await db.slideDeck.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/slides/[id] failed:", e)
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 })
  }
}
