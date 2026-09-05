import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSnippet, countWords, htmlToText } from "@/lib/doc-utils"
import { actorFromRequest, logActivity } from "@/lib/server-activity"
import { guardRoute } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

function toMeta(doc: {
  id: string
  title: string
  content: string
  starred: boolean
  trashed: boolean
  folderId: string | null
  createdAt: Date
  updatedAt: Date
  /** present when fetched with the tags include */
  tags?: { tag: { id: string; name: string; color: string } }[]
}) {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    starred: doc.starred,
    trashed: doc.trashed,
    folderId: doc.folderId,
    tags: [...(doc.tags ?? [])]
      .map((dt) => ({ id: dt.tag.id, name: dt.tag.name, color: dt.tag.color }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    snippet: getSnippet(doc.content),
    wordCount: countWords(htmlToText(doc.content)),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

// GET /api/documents?filter=all|starred|trash&q=search
// Visibility: members see own docs + ownerless legacy docs + docs shared with
// them (collaborator rows keyed by email). Admins see the whole workspace.
export async function GET(req: NextRequest) {
  try {
    const guard = await guardRoute(req)
    if (!guard.ok) return guard.response
    const { user } = guard

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get("filter") ?? "all"
    const q = searchParams.get("q")?.trim() ?? ""
    const folderId = searchParams.get("folder")?.trim() ?? ""

    const base: Record<string, unknown> = {}

    if (filter === "trash") base.trashed = true
    else {
      base.trashed = false
      if (filter === "starred") base.starred = true
    }

    // folder scoping: "root" = documents with no folder; a folder id scopes to it;
    // omitted ("all") = every non-trashed document across folders (used by search)
    if (folderId === "root") base.folderId = null
    else if (folderId && folderId !== "all") base.folderId = folderId

    // compose filters as AND-ed clauses so the visibility OR never collides
    // with the search OR at the top level
    const and: Record<string, unknown>[] = [base]
    if (q) and.push({ OR: [{ title: { contains: q } }, { content: { contains: q } }] })
    if (user.role !== "admin") {
      and.push({
        OR: [
          { ownerId: user.id },
          { ownerId: null },
          { collaborators: { some: { email: user.email } } },
        ],
      })
    }

    const documents = await db.document.findMany({
      where: { AND: and } as never,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      },
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
    const guard = await guardRoute(req, { mutating: true, limit: 60 })
    if (!guard.ok) return guard.response
    const { user } = guard

    const body = (await req.json().catch(() => ({}))) as { title?: string; content?: string }
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 150) : "Untitled document"
    const content = typeof body.content === "string" ? body.content.slice(0, 5 * 1024 * 1024) : ""

    const doc = await db.document.create({ data: { title, content, ownerId: user.id } })
    await logActivity({
      app: "docs",
      kind: "created",
      entityId: doc.id,
      entityTitle: doc.title,
      actor: await actorFromRequest(req),
    })
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
