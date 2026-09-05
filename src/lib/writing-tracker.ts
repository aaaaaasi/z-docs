"use client"

/**
 * Ellipsus-style writing telemetry tracker.
 *
 * Collects REAL metrics while the user types in the editor:
 *  - effective writing time (keystroke bursts; gaps ≤ 5s count, longer gaps
 *    are "thinking pauses")
 *  - writing sessions (a gap > 30 min starts a new session)
 *  - average writing speed (chars or words per active minute, paste excluded)
 *  - keystrokes / typed chars / typed words / pasted chars
 *
 * Persists via PATCH /api/documents/:id/stats (merged server-side).
 *
 * ── CONTRACT (implemented by task 17-c; keep this exact API) ──
 */

export interface WritingStats {
  /** active typing time in ms (gaps ≤ 5s) */
  activeMs: number
  /** number of separate writing sessions (gap > 30 min boundary) */
  sessions: number
  /** count of thinking pauses (> 5s during active writing) */
  pauses: number
  /** total pause duration in ms */
  pauseMs: number
  /** total keystroke events (incl. deletes) */
  keystrokes: number
  /** characters inserted by typing (IME + ASCII), paste excluded */
  typedChars: number
  /** words completed by typing (whitespace-terminated runs; CJK ≈ chars) */
  typedWords: number
  /** characters inserted via paste */
  pastedChars: number
  /** ISO timestamps of first and latest events */
  startedAt: string
  lastAt: string
}

export interface WritingTracker {
  /** Attach a beforeinput observer to the editable element; returns detach. */
  observe(el: HTMLElement): () => void
  /** Persist accumulated stats (debounce caller's responsibility). */
  flush(): Promise<void>
  /** Current in-memory snapshot (merged with server state on load). */
  snapshot(): WritingStats | null
}

/* ── tuning constants ──────────────────────────────────────────────── */

/** inter-event gaps up to 5s are still "actively typing" */
const ACTIVE_WINDOW_MS = 5_000
/** a gap longer than 30 minutes starts a new writing session */
const SESSION_GAP_MS = 30 * 60_000
/** window in which an insertText may be an IME commit echo */
const ECHO_WINDOW_MS = 250

/* ── helpers ───────────────────────────────────────────────────────── */

/** Not-yet-persisted increments accumulated on top of the server baseline. */
interface LocalDelta {
  activeMs: number
  pauses: number
  pauseMs: number
  keystrokes: number
  typedChars: number
  typedWords: number
  pastedChars: number
  /** sessions opened by a >30min gap between two observed events */
  extraSessions: number
  /** true once the first observed event opened the current writing session */
  openedSession: boolean
  startedAt: string
  lastAt: string
}

function emptyDelta(): LocalDelta {
  return {
    activeMs: 0,
    pauses: 0,
    pauseMs: 0,
    keystrokes: 0,
    typedChars: 0,
    typedWords: 0,
    pastedChars: 0,
    extraSessions: 0,
    openedSession: false,
    startedAt: "",
    lastAt: "",
  }
}

function toNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0
}

function toStr(v: unknown): string {
  return typeof v === "string" && v ? v.slice(0, 40) : ""
}

/** Defensive parse of the server stats blob (whitelisted fields only). */
function parseServerStats(raw: unknown): WritingStats | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const s: WritingStats = {
    activeMs: toNum(r.activeMs),
    sessions: toNum(r.sessions),
    pauses: toNum(r.pauses),
    pauseMs: toNum(r.pauseMs),
    keystrokes: toNum(r.keystrokes),
    typedChars: toNum(r.typedChars),
    typedWords: toNum(r.typedWords),
    pastedChars: toNum(r.pastedChars),
    startedAt: toStr(r.startedAt),
    lastAt: toStr(r.lastAt),
  }
  const hasAny =
    s.startedAt ||
    s.lastAt ||
    s.activeMs ||
    s.sessions ||
    s.pauses ||
    s.pauseMs ||
    s.keystrokes ||
    s.typedChars ||
    s.typedWords ||
    s.pastedChars
  return hasAny ? s : null
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

/* ── factory ───────────────────────────────────────────────────────── */

/** Creates a tracker bound to a document (loads existing stats first). */
export function createWritingTracker(docId: string): WritingTracker {
  /** server baseline; null until a GET succeeds and returns real data */
  let base: WritingStats | null = null
  /** true once GET /stats returned 200 (safe to PATCH absolute totals) */
  let baselineKnown = false
  let delta = emptyDelta()
  let dirty = false
  /** bumped on every observed event — guards the flush success check */
  let eventSeq = 0
  /** epoch ms of the previously observed event (0 = none yet) */
  let lastEventAt = 0

  /* IME composition bookkeeping */
  let compositionLen = 0 // chars currently pending in the active composition
  let echoText = "" // committed composition text (dedupes engine echoes)
  let echoAt = 0

  /* async plumbing */
  let loadPromise: Promise<void> | null = null
  let inFlight: Promise<void> | null = null

  const statsUrl = `/api/documents/${docId}/stats`

  /* ---------- server baseline (kicked off at construction) ----------
   * Events observed before the load resolves accumulate in `delta`; the
   * merge happens lazily in mergedStats(), so nothing is lost. */
  const load = (): Promise<void> => {
    if (!loadPromise) {
      loadPromise = (async () => {
        try {
          const r = await fetch(statsUrl, { credentials: "same-origin" })
          if (!r.ok) return
          const data = (await r.json()) as { stats?: unknown }
          baselineKnown = true
          base = parseServerStats(data?.stats)
        } catch {
          /* offline — local events keep accumulating in memory */
        }
      })()
    }
    return loadPromise
  }
  void load()

  /* ---------- merged view (server baseline + local delta) ---------- */
  const mergedStats = (): WritingStats | null => {
    const hasLocal =
      delta.openedSession ||
      delta.extraSessions > 0 ||
      delta.keystrokes > 0 ||
      delta.pastedChars > 0 ||
      delta.activeMs > 0 ||
      delta.pauses > 0
    if (!base) {
      if (!hasLocal) return null
      return {
        activeMs: delta.activeMs,
        sessions: (delta.openedSession ? 1 : 0) + delta.extraSessions,
        pauses: delta.pauses,
        pauseMs: delta.pauseMs,
        keystrokes: delta.keystrokes,
        typedChars: delta.typedChars,
        typedWords: delta.typedWords,
        pastedChars: delta.pastedChars,
        startedAt: delta.startedAt,
        lastAt: delta.lastAt,
      }
    }
    // First event only opens a NEW session when the server has none stored
    // (spec: sessions = max(1, stored sessions)); gaps > 30min always do.
    return {
      activeMs: base.activeMs + delta.activeMs,
      sessions:
        base.sessions + delta.extraSessions + (base.sessions === 0 && delta.openedSession ? 1 : 0),
      pauses: base.pauses + delta.pauses,
      pauseMs: base.pauseMs + delta.pauseMs,
      keystrokes: base.keystrokes + delta.keystrokes,
      typedChars: base.typedChars + delta.typedChars,
      typedWords: base.typedWords + delta.typedWords,
      pastedChars: base.pastedChars + delta.pastedChars,
      startedAt: base.startedAt || delta.startedAt,
      lastAt: delta.lastAt || base.lastAt,
    }
  }

  /* ---------- time accounting ----------
   * gap ≤ 5s            → active writing time
   * 5s < gap ≤ 30min    → one thinking pause (+ its duration)
   * gap > 30min         → a brand-new writing session
   * no previous event   → open the first session, stamp startedAt */
  const bumpTime = (now: number): void => {
    if (lastEventAt > 0) {
      const gap = now - lastEventAt
      if (gap > 0) {
        if (gap <= ACTIVE_WINDOW_MS) {
          delta.activeMs += gap
        } else if (gap <= SESSION_GAP_MS) {
          delta.pauses += 1
          delta.pauseMs += gap
        } else {
          delta.extraSessions += 1
        }
      }
    } else {
      delta.openedSession = true
      delta.startedAt = iso(now)
    }
    delta.lastAt = iso(now)
    lastEventAt = now
  }

  /* ---------- the pure-observation beforeinput handler ---------- */
  const handleBeforeInput = (e: InputEvent): void => {
    const type = e.inputType
    let recognized = true

    if (type === "insertText" || type === "insertCompositionText") {
      const data = typeof e.data === "string" ? e.data : ""
      if (type === "insertCompositionText") {
        // IME rewrites the whole pending composition on every update —
        // only the growth is newly typed text
        const growth = data.length - compositionLen
        if (growth > 0) delta.typedChars += growth
        compositionLen = data.length
        if (data) {
          delta.keystrokes += 1
          if (/\s/.test(data)) delta.typedWords += 1
        }
      } else if (data && echoText && data === echoText && Date.now() - echoAt <= ECHO_WINDOW_MS) {
        // some engines re-fire the committed IME text as insertText —
        // already credited via the composition updates above
        compositionLen = 0
        echoText = ""
      } else {
        compositionLen = 0
        if (data) {
          delta.typedChars += data.length
          delta.keystrokes += 1
          if (/\s/.test(data)) delta.typedWords += 1
        }
      }
    } else if (type === "insertFromPaste" || type === "insertFromPasteAsQuotation") {
      compositionLen = 0
      // pasted text is writing activity, but never a keystroke
      const text = e.dataTransfer ? e.dataTransfer.getData("text/plain") : ""
      delta.pastedChars += text.length
    } else if (type === "insertParagraph" || type === "insertLineBreak") {
      compositionLen = 0
      delta.keystrokes += 1
      delta.typedWords += 1
    } else if (type.startsWith("delete")) {
      compositionLen = 0
      delta.keystrokes += 1 // pressing a delete key is typing activity
    } else {
      recognized = false // formatting / history / drop … — not counted
    }

    if (!recognized) return
    bumpTime(Date.now())
    eventSeq += 1
    dirty = true
  }

  const handleCompositionEnd = (e: CompositionEvent): void => {
    if (typeof e.data === "string" && e.data) {
      echoText = e.data
      echoAt = Date.now()
    }
    compositionLen = 0
  }

  /* ---------- persistence ---------- */
  const doFlush = async (): Promise<void> => {
    if (!dirty) return
    // Never persist before the server baseline is merged in — a local-only
    // PATCH would overwrite the stored totals with smaller numbers.
    await load()
    if (!baselineKnown) {
      // GET failed (offline / auth) — retry the baseline on the next flush
      loadPromise = null
      return
    }
    if (!dirty) return
    const snap = mergedStats()
    if (!snap) return
    const seq = eventSeq
    try {
      const r = await fetch(statsUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true, // lets unload-time flushes complete
        body: JSON.stringify(snap),
      })
      if (r.ok && eventSeq === seq) dirty = false
      // 401/403 or network failure: silently keep the in-memory values
      // (and stay dirty) so a later flush retries with everything intact
    } catch {
      /* offline — the next interval flush retries */
    }
  }

  const flush = (): Promise<void> => {
    if (inFlight) return inFlight
    inFlight = doFlush().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  const snapshot = (): WritingStats | null => mergedStats()

  const observe = (el: HTMLElement): () => void => {
    // pure observation — never preventDefault
    el.addEventListener("beforeinput", handleBeforeInput)
    el.addEventListener("compositionend", handleCompositionEnd)
    return () => {
      el.removeEventListener("beforeinput", handleBeforeInput)
      el.removeEventListener("compositionend", handleCompositionEnd)
    }
  }

  return { observe, flush, snapshot }
}
