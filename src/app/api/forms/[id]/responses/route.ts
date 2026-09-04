import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actorFromRequest, logActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

// GET /api/forms/:id/responses — all submitted responses (newest first)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const form = await db.form.findUnique({ where: { id }, select: { id: true, trashed: true } })
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const responses = await db.formResponse.findMany({
      where: { formId: id },
      orderBy: { submittedAt: "desc" },
    })
    return NextResponse.json({
      responses: responses.map((r) => ({
        id: r.id,
        formId: r.formId,
        answers: r.answers,
        submittedAt: r.submittedAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error("GET /api/forms/[id]/responses failed:", e)
    return NextResponse.json({ error: "Failed to load responses" }, { status: 500 })
  }
}

// POST /api/forms/:id/responses — submit { answers }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as {
      answers?: Record<string, string | string[] | number>
    }
    const form = await db.form.findUnique({ where: { id }, select: { id: true, title: true, trashed: true } })
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (form.trashed) return NextResponse.json({ error: "Form is closed" }, { status: 410 })

    const answers = body.answers ?? {}
    const response = await db.formResponse.create({
      data: { formId: id, answers: JSON.stringify(answers) },
    })
    await logActivity({
      app: "forms",
      kind: "submitted",
      entityId: id,
      entityTitle: form.title,
      detail: "new response received",
      actor: actorFromRequest(req),
    })
    return NextResponse.json(
      {
        response: {
          id: response.id,
          formId: response.formId,
          answers,
          submittedAt: response.submittedAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (e) {
    console.error("POST /api/forms/[id]/responses failed:", e)
    return NextResponse.json({ error: "Failed to submit response" }, { status: 500 })
  }
}
