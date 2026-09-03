import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSnippet, countWords, htmlToText } from "@/lib/doc-utils"

export const dynamic = "force-dynamic"

function toMeta(doc: {
  id: string
  title: string
  content: string
  starred: boolean
  trashed: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    starred: doc.starred,
    trashed: doc.trashed,
    snippet: getSnippet(doc.content),
    wordCount: countWords(htmlToText(doc.content)),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

// GET /api/documents?filter=all|starred|trash&q=search
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get("filter") ?? "all"
    const q = searchParams.get("q")?.trim() ?? ""

    const conditions: Record<string, unknown> = {}

    if (filter === "trash") conditions.trashed = true
    else {
      conditions.trashed = false
      if (filter === "starred") conditions.starred = true
    }

    if (q) {
      conditions.OR = [{ title: { contains: q } }, { content: { contains: q } }]
    }

    const documents = await db.document.findMany({
      where: conditions as never,
      orderBy: { updatedAt: "desc" },
      take: 200,
    })

    return NextResponse.json({ documents: documents.map(toMeta) })
  } catch (e) {
    console.error("GET /api/documents failed:", e)
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 })
  }
}

// POST /api/documents { title?, content? }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string; content?: string }
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 150) : "Untitled document"
    const content = typeof body.content === "string" ? body.content.slice(0, 5 * 1024 * 1024) : ""

    const doc = await db.document.create({ data: { title, content } })
    return NextResponse.json(
      {
        document: {
          ...doc,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (e) {
    console.error("POST /api/documents failed:", e)
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 })
  }
}
