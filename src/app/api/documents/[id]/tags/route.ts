import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

const MAX_TAGS_PER_DOC = 50

// PUT /api/documents/:id/tags { tagIds: string[] } — set the exact tag set of the document
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { tagIds?: unknown }

    if (!Array.isArray(body.tagIds) || body.tagIds.some((v) => typeof v !== "string")) {
      return NextResponse.json({ error: "tagIds must be an array of strings" }, { status: 400 })
    }
    // dedupe + cap
    const tagIds = [...new Set(body.tagIds as string[])].slice(0, MAX_TAGS_PER_DOC)

    const doc = await db.document.findUnique({ where: { id }, select: { id: true } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // keep only ids that exist as tags (unknown ids are dropped)
    const tags = tagIds.length
      ? await db.tag.findMany({
          where: { id: { in: tagIds } },
          select: { id: true, name: true, color: true },
        })
      : []

    await db.$transaction([
      db.documentTag.deleteMany({ where: { docId: id } }),
      ...(tags.length
        ? [db.documentTag.createMany({ data: tags.map((t) => ({ docId: id, tagId: t.id })) })]
        : []),
    ])

    const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json({ tags: sorted })
  } catch (e) {
    console.error("PUT /api/documents/[id]/tags failed:", e)
    return NextResponse.json({ error: "Failed to set document tags" }, { status: 500 })
  }
}
