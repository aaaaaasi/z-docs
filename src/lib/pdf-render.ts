import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"

/**
 * Server-side VECTOR PDF renderer.
 *
 * Prints an HTML string to PDF with the headless Chromium build that ships
 * with the sandbox's Playwright cache. Chromium's own layout engine gives
 * Google-Docs-grade output: selectable vector text, correct CJK fonts,
 * correct wrapping of very long words (the raster html2canvas path could not
 * guarantee any of that).
 *
 * Safety: rendering runs fully offline — every hostname is mapped to
 * ~NOTFOUND so the page cannot make any network request (SSF-proof); only
 * `data:` URLs (pasted images) resolve. A concurrency cap + hard timeout keep
 * CPU bounded, and every run gets its own tmp dir that is always removed.
 */

const CHROME_CANDIDATES = [
  process.env.ZDOCS_CHROME_PATH,
  path.join(os.homedir(), ".cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"),
  path.join(os.homedir(), ".cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell"),
  path.join(os.homedir(), ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"),
  path.join(os.homedir(), ".cache/ms-playwright/chromium-1200/chrome-linux64/chrome"),
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
].filter(Boolean) as string[]

let resolvedChrome: string | null | undefined

function findChrome(): string | null {
  if (resolvedChrome !== undefined) return resolvedChrome
  resolvedChrome = CHROME_CANDIDATES.find((p) => existsSync(p)) ?? null
  return resolvedChrome
}

/** Max concurrent renders — keeps CPU bounded if several exports overlap. */
const MAX_CONCURRENT = 2
let active = 0
const waiters: Array<() => void> = []

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++
    return
  }
  await new Promise<void>((resolve) => waiters.push(resolve))
  active++
}

function release(): void {
  active--
  const next = waiters.shift()
  if (next) next()
}

export class PdfRenderError extends Error {
  constructor(message: string, public code: "no-chrome" | "timeout" | "render-failed" = "render-failed") {
    super(message)
  }
}

const RENDER_TIMEOUT_MS = 30_000

async function printOnce(htmlPath: string, outPath: string): Promise<void> {
  const chrome = findChrome()
  if (!chrome) throw new PdfRenderError("No Chromium binary available", "no-chrome")
  const args = [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--disable-remote-fonts",
    "--host-resolver-rules=MAP * ~NOTFOUND",
    "--no-pdf-header-footer",
    `--print-to-pdf=${outPath}`,
    "--virtual-time-budget=15000",
    `file://${htmlPath}`,
  ]
  await new Promise<void>((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: "ignore" })
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill("SIGKILL")
      reject(new PdfRenderError("Chromium render timed out", "timeout"))
    }, RENDER_TIMEOUT_MS)
    child.once("error", (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new PdfRenderError(`Chromium failed to start: ${err.message}`))
    })
    child.once("exit", (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new PdfRenderError(`Chromium exited with code ${code}`))
    })
  })
}

/** Render an HTML document string to a PDF buffer. */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  await acquire()
  let dir: string | null = null
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "zdocs-pdf-"))
    const htmlPath = path.join(dir, "doc.html")
    const outPath = path.join(dir, "out.pdf")
    await writeFile(htmlPath, html, "utf-8")
    await printOnce(htmlPath, outPath)
    const pdf = await readFile(outPath)
    if (pdf.length < 100) throw new PdfRenderError("Chromium produced an empty PDF")
    return pdf
  } finally {
    release()
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
