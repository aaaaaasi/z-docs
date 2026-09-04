import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSnippet, countWords, htmlToText } from "@/lib/doc-utils"
import { actorFromRequest, logActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

// POST /api/documents/:id/duplicate
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const copy = await db.document.create({
      data: {
        title: `Copy of ${doc.title}`.slice(0, 150),
        content: doc.content,
      },
    })
    await logActivity({
      app: "docs",
      kind: "duplicated",
      entityId: copy.id,
      entityTitle: copy.title,
      detail: `copy of “${doc.title}”`,
      actor: actorFromRequest(req),
    })

    return NextResponse.json(
      {
        document: {
          ...copy,
          snippet: getSnippet(copy.content),
          wordCount: countWords(htmlToText(copy.content)),
          createdAt: copy.createdAt.toISOString(),
          updatedAt: copy.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (e) {
    console.error("POST duplicate failed:", e)
    return NextResponse.json({ error: "Failed to duplicate document" }, { status: 500 })
  }
}
