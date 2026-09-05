import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { guardRoute } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/export — the caller's OWN data snapshot (documents, sheets, decks,
 * forms + response counts, folders, tags, activity) used by Settings →
 * "Export your data". Every user is independent: only their private entities.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await guardRoute(req)
    if (!guard.ok) return guard.response
    const me = guard.user

    const [documents, folders, tags, sheets, decks, forms, activity] = await Promise.all([
      db.document.findMany({
        where: { trashed: false, ownerId: me.id },
        select: {
          id: true,
          title: true,
          content: true,
          starred: true,
          folderId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.folder.findMany({ where: { ownerId: me.id }, select: { id: true, name: true, color: true } }),
      db.tag.findMany({ where: { ownerId: me.id }, select: { id: true, name: true, color: true } }),
      db.sheet.findMany({
        where: { trashed: false, ownerId: me.id },
        select: { id: true, title: true, data: true, starred: true, updatedAt: true },
      }),
      db.slideDeck.findMany({
        where: { trashed: false, ownerId: me.id },
        select: { id: true, title: true, data: true, starred: true, updatedAt: true },
      }),
      db.form.findMany({
        where: { trashed: false, ownerId: me.id },
        select: {
          id: true,
          title: true,
          description: true,
          data: true,
          starred: true,
          updatedAt: true,
          _count: { select: { responses: true } },
        },
      }),
      db.activityLog.findMany({
        where: { actorId: me.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { app: true, kind: true, entityTitle: true, detail: true, createdAt: true },
      }),
    ])

    const payload = {
      exportedAt: new Date().toISOString(),
      product: "Z-Docs workspace export",
      counts: {
        documents: documents.length,
        sheets: sheets.length,
        decks: decks.length,
        forms: forms.length,
        folders: folders.length,
        tags: tags.length,
      },
      documents,
      folders,
      tags,
      sheets,
      decks,
      forms: forms.map((f) => ({ ...f, responseCount: f._count.responses })),
      activity,
    }
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="z-workspace-export.json"`,
      },
    })
  } catch (e) {
    console.error("GET /api/export failed:", e)
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 })
  }
}
