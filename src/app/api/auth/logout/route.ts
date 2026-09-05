import { NextRequest } from "next/server"
import { deleteSession, getSessionUser, SESSION_COOKIE } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// POST /api/auth/logout — deletes the server session and clears the cookie
export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") ?? ""
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`))
  const token = match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null
  await deleteSession(token)
  const res = Response.json({ ok: true })
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return res
}
