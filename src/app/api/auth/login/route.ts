import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword, createSession, SESSION_COOKIE, rateLimit, clientIp, tooManyRequests, isSameOrigin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// POST /api/auth/login { email, password }
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403 })
    // brute-force protection: 10 attempts / 5 min per IP
    if (!rateLimit(`login:${clientIp(req)}`, 10, 5 * 60_000)) return tooManyRequests()

    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string }
    const email = body.email?.trim().toLowerCase() ?? ""
    const password = body.password ?? ""
    if (!email || !password) return Response.json({ error: "请输入邮箱和密码" }, { status: 400 })

    const user = await db.user.findUnique({ where: { email } })
    // generic error — never reveal whether the account exists
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "邮箱或密码不正确" }, { status: 401 })
    }

    const { token, expiresAt } = await createSession(user.id)
    const res = Response.json({
      user: { id: user.id, email: user.email, name: user.name, color: user.color, role: user.role },
    })
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}`
    )
    return res
  } catch (e) {
    console.error("POST /api/auth/login failed:", e)
    return Response.json({ error: "登录失败，请稍后重试" }, { status: 500 })
  }
}
