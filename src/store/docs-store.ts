"use client"

import { create } from "zustand"
import type { DocumentDTO, DocumentMeta, DocFilter, FolderDTO } from "@/lib/docs-types"
import { getSnippet, countWords, htmlToText } from "@/lib/doc-utils"
import { getTemplate } from "@/lib/templates"

export interface CreateDocOptions {
  title?: string
  content?: string
  templateId?: string
  folderId?: string | null
}

interface DocsState {
  view: "home" | "editor"
  currentDocId: string | null
  documents: DocumentMeta[]
  folders: FolderDTO[]
  loading: boolean
  error: string | null
  searchQuery: string
  filter: DocFilter
  /** active folder id when filter === "folder" */
  activeFolderId: string | null
  layout: "grid" | "list"
  openAiOnEditor: boolean

  hydrateFromUrl: () => Promise<void>
  bindPopState: () => () => void
  setFilter: (f: DocFilter) => void
  setSearchQuery: (q: string) => void
  setLayout: (l: "grid" | "list") => void
  setOpenAiOnEditor: (v: boolean) => void

  refresh: (opts?: { silent?: boolean }) => Promise<void>
  refreshFolders: () => Promise<void>
  createDoc: (opts?: CreateDocOptions) => Promise<string | null>
  openDoc: (id: string, opts?: { ai?: boolean }) => void
  goHome: () => void

  renameDoc: (id: string, title: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>
  setTrashed: (id: string, trashed: boolean) => Promise<void>
  deleteForever: (id: string) => Promise<void>
  duplicateDoc: (id: string) => Promise<void>
  patchDocMeta: (id: string, patch: Partial<DocumentMeta>) => void

  /* folders */
  openFolder: (id: string) => void
  createFolder: (name: string) => Promise<FolderDTO | null>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  moveToFolder: (docId: string, folderId: string | null) => Promise<void>
}

function docParam(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get("doc")
}

export const useDocsStore = create<DocsState>((set, get) => ({
  view: "home",
  currentDocId: null,
  documents: [],
  folders: [],
  loading: false,
  error: null,
  searchQuery: "",
  filter: "all",
  activeFolderId: null,
  layout: "grid",
  openAiOnEditor: false,

  hydrateFromUrl: async () => {
    const id = docParam()
    if (id) {
      set({ view: "editor", currentDocId: id })
    }
    await get().refresh({ silent: true })
    await get().refreshFolders()
  },

  bindPopState: () => {
    const onPop = () => {
      const id = docParam()
      if (id) {
        set({ view: "editor", currentDocId: id })
      } else {
        set({ view: "home", currentDocId: null })
      }
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  },

  setFilter: (f) => {
    set({ filter: f })
    void get().refresh({ silent: true })
  },
  setSearchQuery: (q) => set({ searchQuery: q }),
  setLayout: (l) => set({ layout: l }),
  setOpenAiOnEditor: (v) => set({ openAiOnEditor: v }),

  refresh: async (opts) => {
    if (!opts?.silent) set({ loading: true })
    set({ error: null })
    try {
      const { filter, searchQuery, activeFolderId } = get()
      const params = new URLSearchParams({ filter })
      // folder scoping only applies to the folder view (not search, which covers everything)
      if (filter === "folder" && activeFolderId && !searchQuery.trim()) {
        params.set("folder", activeFolderId)
      }
      if (searchQuery.trim()) params.set("q", searchQuery.trim())
      const res = await fetch(`/api/documents?${params.toString()}`)
      if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
      const data = (await res.json()) as { documents: DocumentMeta[] }
      set({ documents: data.documents ?? [] })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Something went wrong" })
    } finally {
      set({ loading: false })
    }
  },

  refreshFolders: async () => {
    try {
      const res = await fetch("/api/folders")
      if (!res.ok) return
      const data = (await res.json()) as { folders: FolderDTO[] }
      set({ folders: data.folders ?? [] })
    } catch {
      // non-fatal
    }
  },

  createDoc: async (opts) => {
    try {
      const template = opts?.templateId ? getTemplate(opts.templateId) : undefined
      const body = {
        title: opts?.title ?? template?.title ?? "Untitled document",
        content: opts?.content ?? template?.content ?? "",
      }
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed to create document")
      const data = (await res.json()) as { document: DocumentDTO }
      const id = data.document.id
      // optionally file the new doc into a folder
      const folderId = opts?.folderId ?? null
      if (folderId) {
        await fetch(`/api/documents/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId }),
        }).catch(() => {})
      }
      await get().refresh({ silent: true })
      return id
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Create failed" })
      return null
    }
  },

  openDoc: (id, opts) => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/?doc=${encodeURIComponent(id)}`)
    }
    set({ view: "editor", currentDocId: id, openAiOnEditor: !!opts?.ai })
  },

  goHome: () => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/")
    }
    set({ view: "home", currentDocId: null, openAiOnEditor: false })
    void get().refresh({ silent: true })
    void get().refreshFolders()
  },

  renameDoc: async (id, title) => {
    const optimistic = get().documents.map((d) => (d.id === id ? { ...d, title } : d))
    set({ documents: optimistic })
    try {
      await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
    } catch {
      void get().refresh({ silent: true })
    }
  },

  toggleStar: async (id) => {
    const doc = get().documents.find((d) => d.id === id)
    if (!doc) return
    const next = !doc.starred
    set({ documents: get().documents.map((d) => (d.id === id ? { ...d, starred: next } : d)) })
    try {
      await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: next }),
      })
    } catch {
      void get().refresh({ silent: true })
    }
  },

  setTrashed: async (id, trashed) => {
    set({ documents: get().documents.filter((d) => d.id !== id) })
    try {
      await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashed }),
      })
      void get().refresh({ silent: true })
    } catch {
      void get().refresh({ silent: true })
    }
  },

  deleteForever: async (id) => {
    set({ documents: get().documents.filter((d) => d.id !== id) })
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" })
    } catch {
      void get().refresh({ silent: true })
    }
  },

  duplicateDoc: async (id) => {
    try {
      const res = await fetch(`/api/documents/${id}/duplicate`, { method: "POST" })
      if (!res.ok) throw new Error("Duplicate failed")
      await get().refresh({ silent: true })
    } catch {
      void get().refresh({ silent: true })
    }
  },

  patchDocMeta: (id, patch) => {
    set({ documents: get().documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) })
  },

  /* ---------------- folders ---------------- */
  openFolder: (id) => {
    set({ filter: "folder", activeFolderId: id })
    void get().refresh({ silent: true })
  },

  createFolder: async (name) => {
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { folder: FolderDTO }
      await get().refreshFolders()
      return data.folder
    } catch {
      return null
    }
  },

  renameFolder: async (id, name) => {
    const optimistic = get().folders.map((f) => (f.id === id ? { ...f, name } : f))
    set({ folders: optimistic })
    try {
      const res = await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      })
      if (!res.ok) throw new Error("rename failed")
      await get().refreshFolders()
    } catch {
      await get().refreshFolders()
    }
  },

  deleteFolder: async (id) => {
    set({ folders: get().folders.filter((f) => f.id !== id) })
    try {
      await fetch(`/api/folders?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    } catch {
      // ignore
    }
    // if we were viewing the deleted folder, fall back to all docs
    if (get().activeFolderId === id) {
      set({ filter: "all", activeFolderId: null })
    }
    await get().refresh({ silent: true })
    await get().refreshFolders()
  },

  moveToFolder: async (docId, folderId) => {
    set({ documents: get().documents.map((d) => (d.id === docId ? { ...d, folderId } : d)) })
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      })
      if (!res.ok) throw new Error("move failed")
    } catch {
      void get().refresh({ silent: true })
    }
    await get().refreshFolders()
  },
}))

export function toMeta(doc: DocumentDTO): DocumentMeta {
  return {
    id: doc.id,
    title: doc.title,
    starred: doc.starred,
    trashed: doc.trashed,
    folderId: doc.folderId ?? null,
    snippet: getSnippet(doc.content),
    wordCount: countWords(htmlToText(doc.content)),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}
