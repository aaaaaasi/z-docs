import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  guardRoute,
  ownedAccessLevel,
  hasAccess,
  getSessionUser,
  rateLimit,
  clientIp,
  tooManyRequests,
} from "@/lib/server-auth"
import { logActivity } from "@/lib/server-activity"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

// GET /api/forms/:id/responses — all submitted responses (newest first).
// Responses are the form owner's asset: owner/admin only. Strangers get 404
// (form ids are unguessable cuids, so 404 also hides existence); legacy
// ownerless forms are readable members-only, but response data stays
// owner/admin (403 for viewers).
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const g = await guardRoute(req)
    if (!g.ok) return g.response

    const { id } = await params
    const level = await ownedAccessLevel(g.user, "form", id)
    if (level === "none") return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!hasAccess(level, "owner")) {
      return NextResponse.json({ error: "You do not have permission to view responses" }, { status: 403 })
    }

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

// POST /api/forms/:id/responses — submit { answers }.
//
// Anonymous submission is ALLOWED (sharing a form link with respondents is
// the core Google-Forms scenario), so this route deliberately does NOT use
// guardRoute (it would 401 respondents). Instead the manual guard bundle:
//   - strict per-IP rate limit (8 submissions / 10 min)
//   - body shape + size validation
//   - the form must exist and not be trashed
//   - response body never echoes form definition data
// A logged-in submitter is attributed in the activity log via their session.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    if (!rateLimit(`formresp:${clientIp(req)}`, 8, 10 * 60_000)) {
      return tooManyRequests("Too many submissions from this network — please try again later.")
    }

    const body = (await req.json().catch(() => ({}))) as {
      answers?: Record<string, string | string[] | number>
    }
    const answers = body.answers ?? {}
    if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid answers payload" }, { status: 400 })
    }
    // every value must be a scalar or array of scalars; cap the payload size
    let serialized = "{}"
    try {
      serialized = JSON.stringify(answers)
    } catch {
      return NextResponse.json({ error: "Invalid answers payload" }, { status: 400 })
    }
    if (serialized.length > 20_000) {
      return NextResponse.json({ error: "Response is too large" }, { status: 413 })
    }
    for (const value of Object.values(answers)) {
      const okValue =
        typeof value === "string" ||
        typeof value === "number" ||
        (Array.isArray(value) && value.every((v) => typeof v === "string" || typeof v === "number"))
      if (!okValue) return NextResponse.json({ error: "Invalid answers payload" }, { status: 400 })
    }

    const form = await db.form.findUnique({ where: { id }, select: { id: true, title: true, trashed: true } })
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (form.trashed) return NextResponse.json({ error: "Form is closed" }, { status: 410 })

    const response = await db.formResponse.create({
      data: { formId: id, answers: serialized },
    })

    // attribution: session user when the respondent is signed in
    const sessionUser = await getSessionUser(req)
    await logActivity({
      app: "forms",
      kind: "submitted",
      entityId: id,
      entityTitle: form.title,
      detail: "new response received",
      actor: sessionUser
        ? { id: sessionUser.id, name: sessionUser.name, color: sessionUser.color }
        : { id: "anonymous", name: "Anonymous respondent", color: "#0b6b62" },
    })

    // only the acknowledgment is returned — no form definition data
    return NextResponse.json(
      { response: { id: response.id, submittedAt: response.submittedAt.toISOString() } },
      { status: 201 }
    )
  } catch (e) {
    console.error("POST /api/forms/[id]/responses failed:", e)
    return NextResponse.json({ error: "Failed to submit response" }, { status: 500 })
  }
}
