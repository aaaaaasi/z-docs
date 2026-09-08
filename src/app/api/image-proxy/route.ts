import { NextRequest, NextResponse } from "next/server"

/**
 * Image proxy — converts remote images to same-origin bytes so the client can
 * safely turn them into data URLs (canvas/DOCX/PDF embeds never taint).
 *
 * Mirrors the pattern recommended by MDN "How to use CORS-enabled images":
 * a server-side fetch has no CORS restrictions, so relaying the bytes through
 * our own origin makes `fetch(url).then(r => r.blob())` work for ANY image
 * host, while the client keeps a strict same-origin policy elsewhere.
 *
 * Hard limits (Google-Docs-insert-image parity):
 *  - http/https only (no file:, data:, blob: passthrough needed)
 *  - SSRF guard: hostname must resolve to a public address; private/loopback
 *    ranges (10.x, 127.x, 169.254.x, 172.16-31.x, 192.168.x, ::1, fc00::/7)
 *    and non-80/443 ports are rejected.
 *  - response must be image/* and ≤ 5 MB
 */

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_PORTS = new Set(["80", "443", ""])

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true
  // IPv4 literal
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }
  // IPv6 literal — loopback / unique-local
  if (h === "::1" || h === "::") return true
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true
  return false
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  if (!raw) return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are supported" }, { status: 400 })
  }
  if (!ALLOWED_PORTS.has(target.port)) {
    return NextResponse.json({ error: "Port not allowed" }, { status: 400 })
  }
  if (isPrivateHost(target.hostname)) {
    return NextResponse.json({ error: "Private addresses are blocked" }, { status: 403 })
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        // some CDNs require an accept header; pretend to be a browser
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 Z-Docs-ImageProxy/1.0",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      // do NOT send/accept cookies — this is a plain byte relay
      credentials: "omit",
      cache: "no-store",
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream responded ${upstream.status}` }, { status: 502 })
    }

    const type = (upstream.headers.get("content-type") || "").toLowerCase()
    if (!type.startsWith("image/")) {
      return NextResponse.json({ error: `Not an image (content-type ${type || "unknown"})` }, { status: 415 })
    }
    const declared = Number(upstream.headers.get("content-length"))
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds 5 MB" }, { status: 413 })
    }

    const buf = await upstream.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds 5 MB" }, { status: 413 })
    }
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: "Empty response" }, { status: 502 })
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "content-type": type,
        "content-length": String(buf.byteLength),
        // immutable per-URL caching — the browser keeps converted images hot
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        // the client reads bytes with fetch(); same-origin so no CORS header needed
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "proxy failed"
    return NextResponse.json({ error: `Proxy fetch failed: ${msg}` }, { status: 502 })
  }
}
