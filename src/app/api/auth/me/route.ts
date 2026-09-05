import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/auth/me — current session user (401 when signed out)
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 })
  return Response.json({ user })
}
