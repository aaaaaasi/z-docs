import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { guardRoute, docAccessLevel, hasAccess } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** Fields the client owns inside the stats blob (server merges, never trusts for edits). */
const CLIENT_FIELDS = new Set([
  "activeMs", "sessions", "pauses", "pauseMs", "keystrokes",
  "typedChars", "typedWords", "pastedChars", "startedAt", "lastAt",
])

function parseStats(raw: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// GET /api/documents/[id]/stats
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardRoute(req)
  if (!g.ok) return g.response
  const { id } = await ctx.params

  const access = await docAccessLevel(g.user, id)
  if (!hasAccess(access, "viewer")) return Response.json({ error: "No access" }, { status: 403 })

  const doc = await db.document.findUnique({ where: { id }, select: { stats: true, editCount: true } })
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 })
  return Response.json({ stats: parseStats(doc.stats), editCount: doc.editCount })
}

// PATCH /api/documents/[id]/stats — client telemetry merge (editor+ required)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guardRoute(req, { mutating: true, limit: 60, windowMs: 60_000 })
  if (!g.ok) return g.response
  const { id } = await ctx.params

  const access = await docAccessLevel(g.user, id)
  if (!hasAccess(access, "editor")) return Response.json({ error: "Editor access required" }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const current = parseStats((await db.document.findUnique({ where: { id }, select: { stats: true } }))?.stats ?? "")

  // merge only whitelisted numeric/timestamp fields, guarding types
  const merged: Record<string, unknown> = { ...current }
  for (const [k, v] of Object.entries(body)) {
    if (!CLIENT_FIELDS.has(k)) continue
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) merged[k] = v
    else if (typeof v === "string" && v.length <= 40) merged[k] = v
  }

  await db.document.update({
    where: { id },
    data: { stats: JSON.stringify(merged) },
  })
  return Response.json({ ok: true, stats: merged })
}
