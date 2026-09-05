import { NextRequest } from "next/server"
import { getSessionUser, docAccessLevel, isInternalRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/internal/doc-access?docId=… — trusted-service endpoint used by
 * collab-service (:3003) to authorize realtime joins. Two ways in:
 *   1. x-internal-secret header (first-party services)
 *   2. forwarded session cookie (the caller must pass the browser's cookie)
 * Returns { access: "owner" | "editor" | "viewer" | "admin" | "none", user }.
 */
export async function GET(req: NextRequest) {
  // require the shared secret OR an authenticated browser session
  if (!isInternalRequest(req)) {
    const user = await getSessionUser(req)
    if (!user) return Response.json({ error: "Not authorized" }, { status: 401 })
  }

  const docId = new URL(req.url).searchParams.get("docId")?.trim()
  if (!docId) return Response.json({ error: "docId is required" }, { status: 400 })

  const user = await getSessionUser(req)
  if (!user) return Response.json({ access: "none", user: null })

  const access = await docAccessLevel(user, docId)
  return Response.json({ access, user: { id: user.id, name: user.name, color: user.color } })
}
