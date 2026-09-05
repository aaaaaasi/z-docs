import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { countWords, htmlToText } from "@/lib/doc-utils"
import { guardRoute, docAccessLevel, hasAccess, notFound } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/documents/:id/versions — viewer+
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await guardRoute(req)
    if (!guard.ok) return guard.response
    const level = await docAccessLevel(guard.user, id)
    if (!hasAccess(level, "viewer")) return notFound()

    const doc = await db.document.findUnique({ where: { id }, select: { id: true } })
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const versions = await db.documentVersion.findMany({
      where: { docId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({
      versions: versions.map((v) => ({
        id: v.id,
        docId: v.docId,
        title: v.title,
        content: v.content,
        wordCount: countWords(htmlToText(v.content)),
        createdAt: v.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error("GET versions failed:", e)
    return NextResponse.json({ error: "Failed to load versions" }, { status: 500 })
  }
}
