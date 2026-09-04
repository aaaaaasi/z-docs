/**
 * Word-level text diff for the version-history "compare" view.
 *
 * Strategy: two-pass diff.
 *  1. LCS over *lines* (paragraph-scale, cheap even for long documents).
 *  2. For each paired del/add run, a second LCS over *word tokens* inside the
 *     run, so single-word edits inside a paragraph light up precisely.
 * Sizes are guarded so pathological inputs fall back to coarser granularity.
 */

export interface DiffSegment {
  type: "same" | "add" | "del"
  text: string
}

export interface DiffStats {
  addedWords: number
  removedWords: number
}

export function diffStats(segments: DiffSegment[]): DiffStats {
  let addedWords = 0
  let removedWords = 0
  for (const s of segments) {
    if (s.type === "add") addedWords += countWordsIn(s.text)
    else if (s.type === "del") removedWords += countWordsIn(s.text)
  }
  return { addedWords, removedWords }
}

function countWordsIn(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/* ---------------------------------------------------------------- LCS core */

type Op = 0 | 1 | 2 // 0 = same, 1 = del (from a), 2 = add (from b)

/** Classic LCS backtrack. Returns an op per token of a/b. */
function lcsOps(a: string[], b: string[], maxCells = 4_000_000): Op[] | null {
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []
  if ((n + 1) * (m + 1) > maxCells) return null // too large — caller falls back

  // DP matrix of LCS lengths, flattened, Uint32 (docs never exceed 2^32 tokens)
  const width = m + 1
  const dp = new Uint32Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + (j + 1)] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)])
    }
  }

  // Backtrack
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push(0)
      i++
      j++
    } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
      ops.push(1)
      i++
    } else {
      ops.push(2)
      j++
    }
  }
  while (i < n) {
    ops.push(1)
    i++
  }
  while (j < m) {
    ops.push(2)
    j++
  }
  return ops
}

/** Turn ops + tokens into merged text segments. */
function opsToSegments(ops: Op[], a: string[], b: string[]): DiffSegment[] {
  const out: DiffSegment[] = []
  const push = (type: DiffSegment["type"], text: string) => {
    const last = out[out.length - 1]
    if (last && last.type === type) last.text += text
    else out.push({ type, text })
  }
  let ai = 0
  let bi = 0
  for (const op of ops) {
    if (op === 0) {
      push("same", a[ai])
      ai++
      bi++
    } else if (op === 1) {
      push("del", a[ai])
      ai++
    } else {
      push("add", b[bi])
      bi++
    }
  }
  // drop empty artifacts
  for (let k = out.length - 1; k >= 0; k--) {
    if (!out[k].text) out.splice(k, 1)
  }
  return out
}

/* ------------------------------------------------------------ word tokens */

function tokenizeWords(text: string): string[] {
  // keep whitespace runs as their own tokens so joins reproduce spacing
  return text.split(/(\s+)/).filter((t) => t.length > 0)
}

/** Word-level diff of two plain-text strings (no line pairing). */
function diffTokens(a: string, b: string): DiffSegment[] {
  const ta = tokenizeWords(a)
  const tb = tokenizeWords(b)
  const ops = lcsOps(ta, tb)
  if (!ops) {
    // fallback: whole block swapped
    return [
      ...(a ? [{ type: "del" as const, text: a }] : []),
      ...(b ? [{ type: "add" as const, text: b }] : []),
    ]
  }
  return opsToSegments(ops, ta, tb)
}

/* --------------------------------------------------------------- pipeline */

function splitLines(text: string): string[] {
  // keep line content; the newline itself is re-appended on join
  return text.split("\n")
}

/**
 * Full diff: line-level LCS, then word-level refinement inside paired
 * del/add runs. `add` segments highlight text present in `newText`;
 * `del` segments show text that only existed in `oldText`.
 */
export function diffText(oldText: string, newText: string): DiffSegment[] {
  const a = splitLines(oldText)
  const b = splitLines(newText)

  // identical fast-path
  if (oldText === newText) return oldText ? [{ type: "same", text: oldText }] : []

  const la = a.map((l) => l.trimEnd())
  const lb = b.map((l) => l.trimEnd())

  const ops = lcsOps(la, lb) ?? fallbackOps(la.length, lb.length)

  // Walk ops with running line indices, collecting runs of consecutive
  // del/add lines, then refine each paired run at word level.
  const segments: DiffSegment[] = []
  const push = (type: DiffSegment["type"], text: string) => {
    if (!text) return
    const last = segments[segments.length - 1]
    if (last && last.type === type) last.text += text
    else segments.push({ type, text })
  }

  let ai = 0
  let bi = 0
  let i = 0
  const total = ops.length
  while (i < total) {
    if (ops[i] === 0) {
      push("same", a[ai] + "\n")
      ai++
      bi++
      i++
      continue
    }
    // collect one run of consecutive del/add lines
    const dels: string[] = []
    const adds: string[] = []
    while (i < total && ops[i] !== 0) {
      if (ops[i] === 1) {
        dels.push(a[ai])
        ai++
      } else {
        adds.push(b[bi])
        bi++
      }
      i++
    }
    // pair up del/add lines for word-level refinement
    const pairs = Math.min(dels.length, adds.length)
    for (let k = 0; k < pairs; k++) {
      for (const seg of diffTokens(dels[k], adds[k])) {
        push(seg.type, seg.text)
      }
      push("same", "\n")
    }
    for (let k = pairs; k < dels.length; k++) {
      push("del", dels[k] + "\n")
    }
    for (let k = pairs; k < adds.length; k++) {
      push("add", adds[k] + "\n")
    }
  }

  // tidy: collapse whitespace-only seams, then strip trailing newline(s)
  const cleaned = collapseNoise(segments)
  while (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1]
    const stripped = last.text.replace(/\n+$/, "")
    if (stripped === last.text) break
    if (stripped) {
      last.text = stripped
      break
    }
    cleaned.pop()
  }
  return cleaned
}

/** Trivial fallback when LCS is too large: everything replaced. */
function fallbackOps(n: number, m: number): Op[] {
  const ops: Op[] = []
  for (let k = 0; k < n; k++) ops.push(1)
  for (let k = 0; k < m; k++) ops.push(2)
  return ops
}

/** Merge whitespace-only segments into neighbours and drop trailing blanks. */
function collapseNoise(segments: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = []
  for (const s of segments) {
    const isBlank = !s.text.trim()
    if (isBlank && out.length > 0 && s.type !== out[out.length - 1].type) {
      // blank whitespace between different types: attach to the previous
      out[out.length - 1].text += s.text
      continue
    }
    const last = out[out.length - 1]
    if (last && last.type === s.type) last.text += s.text
    else out.push({ ...s })
  }
  return out.filter((s) => s.text.length > 0)
}
