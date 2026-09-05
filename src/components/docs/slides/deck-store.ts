"use client"

/**
 * Z-Slides — deck store (zustand, module-level so state survives mode
 * switches and unmounts). Holds the drive-like deck list (with lazily
 * fetched preview data) plus the open deck's editor state, autosave and a
 * 30-step undo stack of deck-data snapshots.
 */

import { create } from "zustand"
import { api } from "@/lib/api-client"
import { getCurrentLang, tForLang } from "@/lib/i18n"
import type { DeckData, DeckTheme, Slide, SlideDeckMeta, SlideLayout } from "@/lib/workspace-types"
import { DEFAULT_THEME, makeSlide, newSlideId, parseDeckData } from "./slide-render"

export type SlideTab = "all" | "starred" | "trashed"
export type SaveStatus = "saved" | "pending" | "saving" | "error"

const JSON_HEADERS = { "Content-Type": "application/json" }

/** module-level preview cache — survives store resets (keyed by id+updatedAt) */
interface PreviewEntry {
  at: string
  data: DeckData | null
}
const previewCache = new Map<string, PreviewEntry>()

/** module-level autosave timer */
let saveTimer: ReturnType<typeof setTimeout> | null = null
/** last time a notes snapshot was pushed (avoid per-keystroke undo steps) */
let lastNotesSnapshot = 0

interface SlidesState {
  /* ------- list mode ------- */
  decks: SlideDeckMeta[]
  listLoading: boolean
  listError: string | null
  tab: SlideTab
  search: string
  /** parsed deck data per deck id (undefined = loading, null = failed) */
  previews: Record<string, DeckData | null>

  fetchList: (opts?: { silent?: boolean }) => Promise<void>
  setTab: (tab: SlideTab) => void
  setSearch: (q: string) => void
  ensurePreviews: () => Promise<void>

  createAndOpenDeck: () => Promise<SlideDeckMeta | null>
  duplicateDeck: (meta: SlideDeckMeta) => Promise<boolean>
  renameDeck: (id: string, title: string) => Promise<boolean>
  setDeckStar: (id: string, starred: boolean) => Promise<void>
  setDeckTrashed: (id: string, trashed: boolean) => Promise<void>
  deleteDeckForever: (id: string) => Promise<void>

  /* ------- editor mode ------- */
  deckId: string | null
  title: string
  deckStarred: boolean
  data: DeckData | null
  currentSlideId: string | null
  saveStatus: SaveStatus
  undoStack: DeckData[]

  openDeck: (id: string) => Promise<boolean>
  closeDeck: () => Promise<void>
  selectSlide: (id: string) => void
  moveSelection: (dir: 1 | -1) => void
  updateSlide: (id: string, patch: Partial<Slide>, opts?: { snapshot?: boolean }) => void
  updateSlideNotes: (id: string, notes: string) => void
  addSlide: (layout: SlideLayout, afterId?: string) => string
  duplicateSlide: (id: string) => void
  deleteSlide: (id: string) => void
  moveSlide: (id: string, dir: 1 | -1) => void
  setSlideLayout: (id: string, layout: SlideLayout) => void
  setTheme: (patch: Partial<DeckTheme>) => void
  renameOpenDeck: (title: string) => Promise<void>
  toggleOpenDeckStar: () => Promise<void>
  undo: () => boolean
  saveNow: () => Promise<void>
}

export const useSlidesStore = create<SlidesState>()((set, get) => {
  /* ---------- internal helpers ---------- */

  const patchDeckMeta = (id: string, patch: Partial<SlideDeckMeta>) =>
    set({ decks: get().decks.map((d) => (d.id === id ? { ...d, ...patch } : d)) })

  const scheduleSave = () => {
    set({ saveStatus: "pending" })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get().saveNow()
    }, 900)
  }

  /** apply a deck mutation with an undo snapshot + autosave */
  const mutate = (fn: (d: DeckData) => DeckData) => {
    const prev = get().data
    if (!prev) return
    set({
      data: fn(prev),
      undoStack: [...get().undoStack.slice(-29), prev],
    })
    scheduleSave()
  }

  const slideIndexOf = (id: string | null) => {
    const d = get().data
    if (!d || !id) return -1
    return d.slides.findIndex((s) => s.id === id)
  }

  return {
    /* ---------- list mode ---------- */
    decks: [],
    listLoading: false,
    listError: null,
    tab: "all",
    search: "",
    previews: {},

    fetchList: async (opts) => {
      if (!opts?.silent) set({ listLoading: true, listError: null })
      try {
        const params = new URLSearchParams({ filter: get().tab })
        const q = get().search.trim()
        if (q) params.set("q", q)
        const res = await api(`/api/slides?${params.toString()}`)
        if (!res.ok) throw new Error(`Failed to load decks (${res.status})`)
        const json = (await res.json()) as { decks: SlideDeckMeta[] }
        set({ decks: json.decks ?? [] })
        void get().ensurePreviews()
      } catch (e) {
        const lang = getCurrentLang()
        const raw = e instanceof Error ? e.message : "Something went wrong"
        // localize known list-error phrases, keep unknown/technical text as-is
        set({
          listError:
            raw === "Something went wrong"
              ? tForLang(lang, "Something went wrong")
              : /^Failed to load decks \(\d+\)$/.test(raw)
                ? tForLang(lang, "Failed to load decks ({status})", {
                    status: raw.match(/\((\d+)\)/)?.[1] ?? "",
                  })
                : raw,
        })
      } finally {
        if (!opts?.silent) set({ listLoading: false })
      }
    },

    setTab: (tab) => {
      if (tab === get().tab) return
      set({ tab, decks: [], listError: null })
      void get().fetchList()
    },

    setSearch: (q) => set({ search: q }),

    /** lazily fetch deck payloads so list cards can render live previews */
    ensurePreviews: async () => {
      const missing = get().decks.filter((d) => {
        const c = previewCache.get(d.id)
        return !c || c.at !== d.updatedAt
      })
      if (missing.length === 0) {
        // publish whatever we already have
        const previews: Record<string, DeckData | null> = {}
        get().decks.forEach((d) => {
          const c = previewCache.get(d.id)
          if (c) previews[d.id] = c.data
        })
        set({ previews })
        return
      }
      await Promise.all(
        missing.map(async (deck) => {
          try {
            const res = await api(`/api/slides/${encodeURIComponent(deck.id)}`)
            if (!res.ok) throw new Error(String(res.status))
            const json = (await res.json()) as { deck: { data: string } }
            previewCache.set(deck.id, { at: deck.updatedAt, data: parseDeckData(json.deck.data) })
          } catch {
            previewCache.set(deck.id, { at: deck.updatedAt, data: null })
          }
        })
      )
      const previews: Record<string, DeckData | null> = {}
      get().decks.forEach((d) => {
        const c = previewCache.get(d.id)
        if (c) previews[d.id] = c.data
      })
      set({ previews })
    },

    createAndOpenDeck: async () => {
      const data: DeckData = { slides: [makeSlide("title")], theme: { ...DEFAULT_THEME } }
      try {
        const res = await api("/api/slides", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            title: tForLang(getCurrentLang(), "Untitled presentation"),
            data: JSON.stringify(data),
          }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { deck: SlideDeckMeta }
        const meta = json.deck
        set({ decks: [meta, ...get().decks.filter((d) => d.id !== meta.id)] })
        set({
          deckId: meta.id,
          title: meta.title,
          deckStarred: meta.starred,
          data,
          currentSlideId: data.slides[0]?.id ?? null,
          saveStatus: "saved",
          undoStack: [],
        })
        return meta
      } catch {
        return null
      }
    },

    duplicateDeck: async (meta) => {
      try {
        // duplicate is client-side per the API contract: fetch then re-POST
        const res = await api(`/api/slides/${encodeURIComponent(meta.id)}`)
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { deck: { data: string } }
        const copy = await api("/api/slides", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            title: tForLang(getCurrentLang(), "Copy of {title}", { title: meta.title }),
            data: json.deck.data,
          }),
        })
        if (!copy.ok) throw new Error(String(copy.status))
        await get().fetchList({ silent: true })
        return true
      } catch {
        return false
      }
    },

    renameDeck: async (id, title) => {
      const trimmed = title.trim().slice(0, 120)
      if (!trimmed) return false
      const before = get().decks.find((d) => d.id === id)
      patchDeckMeta(id, { title: trimmed })
      try {
        const res = await api(`/api/slides/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ title: trimmed }),
        })
        if (!res.ok) throw new Error(String(res.status))
        return true
      } catch {
        if (before) patchDeckMeta(id, { title: before.title })
        return false
      }
    },

    setDeckStar: async (id, starred) => {
      patchDeckMeta(id, { starred })
      try {
        await api(`/api/slides/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ starred }),
        })
      } catch {
        patchDeckMeta(id, { starred: !starred })
      }
    },

    setDeckTrashed: async (id, trashed) => {
      set({ decks: get().decks.filter((d) => d.id !== id) })
      try {
        await api(`/api/slides/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ trashed }),
        })
      } finally {
        await get().fetchList({ silent: true })
      }
    },

    deleteDeckForever: async (id) => {
      set({ decks: get().decks.filter((d) => d.id !== id) })
      try {
        await api(`/api/slides/${encodeURIComponent(id)}`, { method: "DELETE" })
      } finally {
        await get().fetchList({ silent: true })
      }
    },

    /* ---------- editor mode ---------- */
    deckId: null,
    title: "",
    deckStarred: false,
    data: null,
    currentSlideId: null,
    saveStatus: "saved",
    undoStack: [],

    openDeck: async (id) => {
      try {
        const res = await api(`/api/slides/${encodeURIComponent(id)}`)
        if (!res.ok) return false
        const json = (await res.json()) as {
          deck: { id: string; title: string; starred: boolean; data: string }
        }
        const data = parseDeckData(json.deck.data)
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = null
        set({
          deckId: id,
          title: json.deck.title,
          deckStarred: json.deck.starred,
          data,
          currentSlideId: data.slides[0]?.id ?? null,
          saveStatus: "saved",
          undoStack: [],
        })
        return true
      } catch {
        return false
      }
    },

    closeDeck: async () => {
      const status = get().saveStatus
      if (status === "pending" || status === "saving" || status === "error") {
        await get().saveNow()
      }
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      set({
        deckId: null,
        title: "",
        deckStarred: false,
        data: null,
        currentSlideId: null,
        saveStatus: "saved",
        undoStack: [],
      })
    },

    selectSlide: (id) => set({ currentSlideId: id }),

    moveSelection: (dir) => {
      const d = get().data
      if (!d || d.slides.length === 0) return
      const idx = slideIndexOf(get().currentSlideId)
      const next = Math.min(Math.max((idx < 0 ? 0 : idx) + dir, 0), d.slides.length - 1)
      set({ currentSlideId: d.slides[next].id })
    },

    updateSlide: (id, patch, opts) => {
      const prev = get().data
      if (!prev) return
      const slides = prev.slides.map((s) => (s.id === id ? { ...s, ...patch } : s))
      set({ data: { ...prev, slides } })
      if (opts?.snapshot !== false) {
        set({ undoStack: [...get().undoStack.slice(-29), prev] })
      }
      scheduleSave()
    },

    updateSlideNotes: (id, notes) => {
      // snapshot at most once per second so undo steps stay meaningful
      const now = Date.now()
      const snapshot = now - lastNotesSnapshot > 1000
      if (snapshot) lastNotesSnapshot = now
      get().updateSlide(id, { notes }, { snapshot })
    },

    addSlide: (layout, afterId) => {
      const slide = makeSlide(layout)
      mutate((d) => {
        const anchor = afterId ?? get().currentSlideId
        const idx = d.slides.findIndex((s) => s.id === anchor)
        const slides = [...d.slides]
        slides.splice(idx >= 0 ? idx + 1 : slides.length, 0, slide)
        return { ...d, slides }
      })
      set({ currentSlideId: slide.id })
      return slide.id
    },

    duplicateSlide: (id) => {
      mutate((d) => {
        const idx = d.slides.findIndex((s) => s.id === id)
        if (idx < 0) return d
        const copy: Slide = { ...d.slides[idx], id: newSlideId() }
        const slides = [...d.slides]
        slides.splice(idx + 1, 0, copy)
        return { ...d, slides }
      })
      const after = get().data
      const idx = after ? after.slides.findIndex((s) => s.id === id) : -1
      const copy = after && idx >= 0 ? after.slides[idx + 1] : undefined
      if (copy) set({ currentSlideId: copy.id })
    },

    deleteSlide: (id) => {
      const before = get().data
      if (!before) return
      const idx = before.slides.findIndex((s) => s.id === id)
      if (idx < 0) return
      mutate((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== id) }))
      if (get().currentSlideId === id) {
        const after = get().data
        const slides = after?.slides ?? []
        const neighbor = slides[Math.min(idx, slides.length - 1)]
        set({ currentSlideId: neighbor?.id ?? null })
      }
    },

    moveSlide: (id, dir) => {
      mutate((d) => {
        const idx = d.slides.findIndex((s) => s.id === id)
        const to = idx + dir
        if (idx < 0 || to < 0 || to >= d.slides.length) return d
        const slides = [...d.slides]
        const [moved] = slides.splice(idx, 1)
        slides.splice(to, 0, moved)
        return { ...d, slides }
      })
    },

    setSlideLayout: (id, layout) => {
      get().updateSlide(id, { layout })
    },

    setTheme: (patch) => {
      mutate((d) => ({ ...d, theme: { ...d.theme, ...patch } }))
    },

    renameOpenDeck: async (title) => {
      const trimmed = title.trim().slice(0, 120)
      const { deckId } = get()
      if (!deckId || !trimmed) return
      const prevTitle = get().title
      set({ title: trimmed })
      patchDeckMeta(deckId, { title: trimmed })
      try {
        await api(`/api/slides/${encodeURIComponent(deckId)}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ title: trimmed }),
        })
      } catch {
        set({ title: prevTitle })
        patchDeckMeta(deckId, { title: prevTitle })
      }
    },

    toggleOpenDeckStar: async () => {
      const { deckId, deckStarred } = get()
      if (!deckId) return
      const next = !deckStarred
      set({ deckStarred: next })
      patchDeckMeta(deckId, { starred: next })
      try {
        await api(`/api/slides/${encodeURIComponent(deckId)}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ starred: next }),
        })
      } catch {
        set({ deckStarred: deckStarred })
        patchDeckMeta(deckId, { starred: deckStarred })
      }
    },

    undo: () => {
      const { undoStack } = get()
      if (undoStack.length === 0) return false
      const prev = undoStack[undoStack.length - 1]
      set({ data: prev, undoStack: undoStack.slice(0, -1) })
      scheduleSave()
      return true
    },

    saveNow: async () => {
      const { deckId, data, saveStatus } = get()
      if (!deckId || !data || saveStatus === "saving") return
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      set({ saveStatus: "saving" })
      try {
        const res = await api(`/api/slides/${encodeURIComponent(deckId)}`, {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ data: JSON.stringify(data) }),
        })
        if (!res.ok) throw new Error(String(res.status))
        if (get().deckId === deckId) set({ saveStatus: "saved" })
      } catch {
        if (get().deckId === deckId) set({ saveStatus: "error" })
      }
    },
  }
})
