"use client"

import * as React from "react"
import { Mic, Square } from "lucide-react"
import { cn } from "@/lib/utils"

/* ---------------------------------------------------------------- typings */

/* The Web Speech API isn't part of TypeScript's lib.dom yet — declare the
 * shapes we actually use. */
interface SpeechAlternativeLike {
  transcript: string
  confidence: number
}
interface SpeechResultLike {
  isFinal: boolean
  length: number
  [index: number]: SpeechAlternativeLike
}
interface SpeechResultListLike {
  length: number
  [index: number]: SpeechResultLike
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechResultListLike
}
interface SpeechRecognitionErrorEventLike {
  error: string
  message?: string
}
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isVoiceTypingSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

/* ------------------------------------------------------------------- hook */

export interface VoiceTypingApi {
  /** browser support flag (SpeechRecognition API present) */
  supported: boolean
  /** actively listening + auto-restarting across Chrome's silence timeouts */
  listening: boolean
  /** live partial sentence (not yet committed to the document) */
  interim: string
  /** last error code — "not-allowed" (mic denied), "unsupported", … */
  error: string | null
  start: () => void
  stop: () => void
  toggle: () => void
}

/**
 * Continuous dictation on top of the Web Speech API. Final chunks are handed
 * to `onFinalText` (which inserts them at the caret); interim text is only
 * shown in the floating pill. Chrome cuts the recognition session after a
 * few seconds of silence — while the user hasn't pressed stop we restart it
 * automatically so dictation feels continuous.
 */
export function useVoiceTyping(onFinalText: (text: string) => void): VoiceTypingApi {
  const [listening, setListening] = React.useState(false)
  const [interim, setInterim] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const recRef = React.useRef<SpeechRecognitionLike | null>(null)
  const intentRef = React.useRef(false) // user-visible "should be listening"
  const onFinalRef = React.useRef(onFinalText)
  React.useEffect(() => {
    onFinalRef.current = onFinalText
  }, [onFinalText])

  const supported = React.useMemo(() => getSpeechRecognitionCtor() !== null, [])

  const stop = React.useCallback(() => {
    intentRef.current = false
    try {
      recRef.current?.stop()
    } catch {
      // already stopped
    }
    setListening(false)
    setInterim("")
  }, [])

  const start = React.useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError("unsupported")
      return
    }
    if (intentRef.current) return // already listening
    intentRef.current = true
    try {
      const rec = new Ctor()
      recRef.current = rec
      rec.lang = navigator.language || "en-US"
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1
      rec.onresult = (e) => {
        let partial = ""
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          const alt = res[0]
          if (!alt) continue
          const text = alt.transcript.trim()
          if (res.isFinal) {
            if (text) onFinalRef.current(text)
          } else {
            partial += alt.transcript
          }
        }
        setInterim(partial)
      }
      rec.onerror = (e) => {
        // "no-speech" / "aborted" are benign — keep the loop alive.
        if (e.error === "no-speech" || e.error === "aborted") return
        intentRef.current = false
        setError(e.error)
        setListening(false)
        setInterim("")
      }
      rec.onend = () => {
        // Chrome ends the session on silence — restart while still intended.
        if (intentRef.current) {
          try {
            rec.start()
            return
          } catch {
            // fall through to stopping
          }
        }
        setListening(false)
        setInterim("")
      }
      rec.start()
      setError(null)
      setListening(true)
    } catch {
      intentRef.current = false
      setError("start-failed")
    }
  }, [])

  // Kill the recognizer when the component unmounts (doc switch).
  React.useEffect(() => {
    return () => {
      intentRef.current = false
      try {
        recRef.current?.abort()
      } catch {
        // ignore
      }
      recRef.current = null
    }
  }, [])

  const toggle = React.useCallback(() => {
    if (intentRef.current) stop()
    else start()
  }, [start, stop])

  return { supported, listening, interim, error, start, stop, toggle }
}

/* -------------------------------------------------------------------- pill */

/** Floating "listening" indicator shown over the document canvas while
 *  dictation is active — pulsing mic, live interim transcript, stop button. */
export function VoicePill({
  listening,
  interim,
  onStop,
}: {
  listening: boolean
  interim: string
  onStop: () => void
}) {
  if (!listening) return null
  return (
    <div
      role="status"
      aria-label="Voice typing"
      className="no-print elev-2 animate-in fade-in-0 slide-in-from-bottom-2 absolute bottom-6 left-2 z-20 flex max-w-[360px] items-center gap-2.5 rounded-full border bg-background/95 py-2 pl-3.5 pr-2 backdrop-blur-md duration-200"
    >
      <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
      </span>
      <span className="tnum min-w-0 flex-1 select-none truncate text-sm">
        {interim ? (
          <span className="text-foreground">{interim}</span>
        ) : (
          <span className="text-muted-foreground">Listening…</span>
        )}
      </span>
      <button
        type="button"
        aria-label="Stop voice typing"
        onClick={onStop}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-90",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        )}
      >
        <Square className="h-3 w-3 fill-current" strokeWidth={0} />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------ toolbar tip */

/** Small toolbar/menubar helper — renders nothing until listening. */
export function VoiceMicHint({ listening }: { listening: boolean }) {
  if (!listening) return null
  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 flex h-2 w-2 items-center justify-center"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
    </span>
  )
}

export { Mic }
