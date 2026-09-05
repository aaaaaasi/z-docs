import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, createSession, SESSION_COOKIE, rateLimit, clientIp, tooManyRequests, isSameOrigin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/auth/signup { email, name, password }
// Every account is fully independent: no admin, no workspace takeover —
// a fresh account starts with a private, empty workspace of its own.
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return Response.json({ error: "Cross-origin request rejected." }, { status: 403 })
    if (!rateLimit(`signup:${clientIp(req)}`, 5, 10 * 60_000)) return tooManyRequests()

    const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; password?: string }
    const email = body.email?.trim().toLowerCase() ?? ""
    const name = body.name?.trim().slice(0, 60) ?? ""
    const password = body.password ?? ""

    if (!EMAIL_RE.test(email)) return Response.json({ error: "请输入有效的邮箱地址" }, { status: 400 })
    if (name.length < 1) return Response.json({ error: "请输入姓名" }, { status: 400 })
    if (password.length < 8) return Response.json({ error: "密码至少 8 位" }, { status: 400 })
    if (password.length > 200) return Response.json({ error: "密码过长" }, { status: 400 })

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return Response.json({ error: "该邮箱已注册" }, { status: 409 })

    const user = await db.user.create({
      data: { email, name, passwordHash: hashPassword(password) },
    })

    const { token, expiresAt } = await createSession(user.id)
    const res = Response.json({
      user: { id: user.id, email: user.email, name: user.name, color: user.color },
    })
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}`
    )
    return res
  } catch (e) {
    console.error("POST /api/auth/signup failed:", e)
    return Response.json({ error: "注册失败，请稍后重试" }, { status: 500 })
  }
}
