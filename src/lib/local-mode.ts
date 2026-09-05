/**
 * Guest mode — local-only workspace.
 *
 * `installGuestApi()` wraps `window.fetch` so that every `/api/*` request
 * except `/api/auth/*` and `/api/import/*` is served from a localStorage-backed
 * database (see local-mode/db.ts + local-mode/routes.ts) instead of hitting the
 * server. The wrapped calls return real `Response` objects whose shapes mirror
 * the server routes byte-for-byte, so the entire app (Z-Docs editor, Z-Sheets,
 * Z-Slides, Z-Forms, activity, storage, export, comments, folders, tags,
 * versions) works fully offline with no code changes.
 *
 * AI and share/collaborator routes answer 403 with a bilingual
 * "sign in required" error; everything else under /api is handled locally.
 * Installing is idempotent, and `uninstallGuestApi()` restores the original
 * fetch untouched.
 */

import { persist } from "./local-mode/db"
import { handleGuestRoute, type GuestRouteResult } from "./local-mode/routes"

export { readGuestSnapshot, clearGuestData, hasGuestData, guestDbStats } from "./local-mode/db"
export type { GuestSnapshot } from "./local-mode/db"
export type { GuestRouteResult } from "./local-mode/routes"

type FetchLike = typeof fetch

/** Marker so installGuestApi() can detect its own wrapper (idempotency). */
const GUEST_FETCH_MARKER = "__zdocsGuestApi"

let originalFetch: FetchLike | null = null

/** Only /api/* paths outside /api/auth and /api/import are handled locally. */
function shouldHandleLocally(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/import/")) return false
  return true
}

function urlOf(input: RequestInfo | URL): URL | null {
  try {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : typeof Request !== "undefined" && input instanceof Request
            ? input.url
            : String(input)
    return new URL(raw, typeof window === "undefined" ? "http://localhost" : window.location.href)
  } catch {
    return null
  }
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  try {
    const explicit = init?.method
    if (typeof explicit === "string" && explicit) return explicit.toUpperCase()
    if (typeof Request !== "undefined" && input instanceof Request) {
      return input.method.toUpperCase()
    }
  } catch {
    // fall through
  }
  return "GET"
}

async function bodyOf(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  try {
    let text: string | null = null
    if (typeof init?.body === "string") {
      text = init.body
    } else if (init?.body == null && typeof Request !== "undefined" && input instanceof Request && input.body) {
      text = await input.clone().text()
    }
    if (text === null || text === "") return {}
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function toResponse(result: GuestRouteResult): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (result.headers) Object.assign(headers, result.headers)
  const text = result.text !== undefined ? result.text : JSON.stringify(result.json ?? {})
  return new Response(text, { status: result.status, headers })
}

/**
 * Wrap window.fetch with the guest-mode API shim.
 * Safe to call multiple times — only the first call wraps.
 */
export function installGuestApi(): void {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return
  const current = window.fetch as FetchLike & { [GUEST_FETCH_MARKER]?: true }
  if (current && current[GUEST_FETCH_MARKER]) return // already installed

  const original = window.fetch
  const wrapped: FetchLike & { [GUEST_FETCH_MARKER]?: true } = async (input, init) => {
    const passThrough = () => Promise.resolve(original.call(window, input, init))

    const url = urlOf(input)
    if (!url || !shouldHandleLocally(url.pathname)) return passThrough()

    const method = methodOf(input, init)
    const body = await bodyOf(input, init)
    const result = handleGuestRoute(url, method, body)

    // mutating requests persist the localStorage DB synchronously
    if (method !== "GET") persist()

    return toResponse(result)
  }
  wrapped[GUEST_FETCH_MARKER] = true
  originalFetch = original
  window.fetch = wrapped as FetchLike
}

/** Restore the original fetch (undoes installGuestApi). */
export function uninstallGuestApi(): void {
  if (typeof window === "undefined") return
  const current = window.fetch as FetchLike & { [GUEST_FETCH_MARKER]?: true }
  if (!current || !current[GUEST_FETCH_MARKER]) return // not installed
  if (originalFetch) window.fetch = originalFetch
  originalFetch = null
}
