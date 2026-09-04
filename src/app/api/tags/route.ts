import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// Fixed Google-like label palette (teal / red / amber / green / purple / gray)
const TAG_COLORS = ["#0b6b62", "#d93025", "#f9ab00", "#1e8e3e", "#a142f4", "#5f6368"]
const TAG_NAME_MAX = 24

// GET /api/tags — all tags with document counts
export async function GET() {
  try {
    const tags = await db.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    })
    return NextResponse.json({
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        count: t._count.documents,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error("GET /api/tags failed:", e)
    return NextResponse.json({ error: "Failed to list tags" }, { status: 500 })
  }
}

// POST /api/tags { name, color? } — create a tag (name unique, max 24 chars)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string; color?: string }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, TAG_NAME_MAX) : ""
    if (!name) return NextResponse.json({ error: "Tag name is required" }, { status: 400 })

    const existing = await db.tag.findFirst({ where: { name }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 })
    }

    const color =
      typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)
        ? body.color
        : TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]

    const tag = await db.tag.create({ data: { name, color } })
    return NextResponse.json(
      {
        tag: {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          count: 0,
          createdAt: tag.createdAt.toISOString(),
          updatedAt: tag.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (e) {
    console.error("POST /api/tags failed:", e)
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }
}
