"use client"

/**
 * Remote-image freezing — fetch a remote image through our same-origin
 * `/api/image-proxy` relay and convert it to a `data:` URL.
 *
 * Why: the MDN spec ("How to use CORS-enabled images") taints any canvas that
 * drew a cross-origin image without CORS approval — which blanks html2canvas
 * PDF exports — and DOCX export can only embed data-URL images. Freezing at
 * insert time makes every document self-contained (Ellipsus/Google-Docs
 * parity: what you insert is what you keep, even if the host later dies).
 *
 * The proxy also defeats image-host CORS refusals, since the server-side
 * fetch ignores the Access-Control-Allow-Origin header entirely.
 */

const PROXY = "/api/image-proxy?url="

/** Is this a remote http(s) image URL (not already frozen)? */
export function isRemoteImageSrc(src: string): boolean {
  if (!src) return false
  return /^https?:\/\//i.test(src.trim())
}

/**
 * Convert one remote image URL to a data URL via the proxy.
 * Returns null on any failure (caller falls back to the raw URL).
 */
export async function remoteImageToDataUrl(url: string): Promise<string | null> {
  if (!isRemoteImageSrc(url)) return null
  try {
    const res = await fetch(PROXY + encodeURIComponent(url.trim()), {
      credentials: "omit",
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size === 0 || !blob.type.startsWith("image/")) return null
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const out = String(reader.result || "")
        resolve(out.startsWith("data:") ? out : null)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Freeze every remote <img> inside a root element (export pre-pass).
 *
 * Returns an `unfreeze()` callback restoring the original src values, so the
 * live document HTML is byte-identical before/after an export capture —
 * export must never silently rewrite the user's saved content.
 *
 * Images already cached as data URLs are skipped; failures keep the remote
 * src (the capture degrades exactly like today instead of hard-failing).
 */
export async function freezeRemoteImages(root: ParentNode): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll("img"))
    .filter((img) => isRemoteImageSrc(img.getAttribute("src") ?? ""))
  if (imgs.length === 0) return () => {}

  const restores: Array<() => void> = []
  await Promise.all(
    imgs.map(async (img) => {
      const original = img.getAttribute("src") ?? ""
      const frozen = await remoteImageToDataUrl(original)
      if (frozen) {
        img.setAttribute("src", frozen)
        restores.push(() => img.setAttribute("src", original))
      }
    })
  )
  return () => {
    for (const r of restores) r()
  }
}

/** Debug helper: how many remote images remain under a root. */
export function countRemoteImages(root: ParentNode): number {
  return Array.from(root.querySelectorAll("img")).filter((img) =>
    isRemoteImageSrc(img.getAttribute("src") ?? "")
  ).length
}
