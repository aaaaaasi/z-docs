import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

const FOLDER_COLORS = ["#0b6b62", "#8f5a0b", "#7c3aed", "#be185d", "#0369a1", "#15803d", "#b91c1c"]

// GET /api/folders — list all folders
export async function GET() {
  try {
    const folders = await db.folder.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    })
    return NextResponse.json({
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        count: f._count.documents,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error("GET /api/folders failed:", e)
    return NextResponse.json({ error: "Failed to list folders" }, { status: 500 })
  }
}

// POST /api/folders { name, color? }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string; color?: string }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : ""
    if (!name) return NextResponse.json({ error: "Folder name is required" }, { status: 400 })

    const existing = await db.folder.findFirst({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: "A folder with this name already exists" }, { status: 409 })
    }

    const color =
      typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)
        ? body.color
        : FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)]

    const folder = await db.folder.create({ data: { name, color } })
    return NextResponse.json(
      { folder: { ...folder, count: 0, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString() } },
      { status: 201 }
    )
  } catch (e) {
    console.error("POST /api/folders failed:", e)
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 })
  }
}

// PATCH /api/folders { id, name?, color? }
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; name?: string; color?: string }
    if (!body.id) return NextResponse.json({ error: "Folder id is required" }, { status: 400 })

    const data: { name?: string; color?: string } = {}
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80)
    if (typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)) data.color = body.color
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    if (data.name) {
      const dupe = await db.folder.findFirst({ where: { name: data.name, NOT: { id: body.id } } })
      if (dupe) return NextResponse.json({ error: "A folder with this name already exists" }, { status: 409 })
    }

    const folder = await db.folder.update({ where: { id: body.id }, data })
    return NextResponse.json({
      folder: { ...folder, createdAt: folder.createdAt.toISOString(), updatedAt: folder.updatedAt.toISOString() },
    })
  } catch (e) {
    console.error("PATCH /api/folders failed:", e)
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 })
  }
}

// DELETE /api/folders?id=... — documents inside move back to root
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Folder id is required" }, { status: 400 })

    const existing = await db.folder.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.document.updateMany({ where: { folderId: id }, data: { folderId: null } })
    await db.folder.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("DELETE /api/folders failed:", e)
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 })
  }
}
