"use client"

import { readLocalUser } from "@/lib/identity"

/**
 * Client fetch wrapper that stamps the local user identity on every mutation
 * (via the `x-z-actor` header) so the server can attribute activity-feed events.
 * Use exactly like fetch().
 *
 * On 401 the session expired client-side: a "zdocs-unauthorized" event fires so
 * the app shell can swap to the login screen immediately.
 */
export function api(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  try {
    const user = readLocalUser()
    if (user) headers.set("x-z-actor", JSON.stringify({ id: user.id, name: user.name, color: user.color }))
  } catch {
    // identity unavailable (SSR) — server falls back to a default actor
  }
  const res = fetch(url, { ...init, headers, credentials: "same-origin" })
  res.then((r) => {
    if (r.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("zdocs-unauthorized"))
    }
  })
  return res
}
