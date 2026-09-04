"use client"

import { create } from "zustand"
import type { DocumentDTO, DocumentMeta, DocFilter, FolderDTO, TagDTO } from "@/lib/docs-types"
import type { WorkspaceView, WorkspaceApp } from "@/lib/workspace-types"
import { getSnippet, countWords, htmlToText } from "@/lib/doc-utils"
import { getTemplate } from "@/lib/templates"

export interface CreateDocOptions {
  title?: string
  content?: string
  templateId?: string
  folderId?: string | null
}

export type AppView = WorkspaceView
export type { WorkspaceApp }

/** Form sub-mode when opening Z-Forms via store ("edit" = builder default) */
export type FormOpenMode = "edit" | "fill" | "responses"

export interface AppTarget {
  app: WorkspaceApp
  id: string | null
  formMode: FormOpenMode | null
}

interface DocsState {
  view: WorkspaceView
  currentDocId: string | null
  /** deep-link target for a workspace app (sheet / deck / form id + form mode) */
  appTarget: AppTarget | null
  documents: DocumentMeta[]
  folders: FolderDTO[]
  tags: TagDTO[]
  loading: boolean
  error: string | null
  searchQuery: string
  filter: DocFilter
  /** active folder id when filter === "folder" */
  activeFolderId: string | null
  /** active tag filter (independent of the folder/starred/trash dimension) */
  tagFilter: string | null
  layout: "grid" | "list"
  openAiOnEditor: boolean

  hydrateFromUrl: () => Promise<void>
  bindPopState: () => () => void
  setFilter: (f: DocFilter) => void
  setSearchQuery: (q: string) => void
  setLayout: (l: "grid" | "list") => void
  setOpenAiOnEditor: (v: boolean) => void

  /** open a workspace app view (optionally deep-linking an entity id) */
  openApp: (app: WorkspaceApp, opts?: { id?: string | null; formMode?: FormOpenMode }) => void
  /** open Recent activity / Settings views */
  openActivity: () => void
  openSettings: () => void
  /** one-shot: read + clear the pending app deep-link target (apps call on mount) */
  consumeAppTarget: () => AppTarget | null

  refresh: (opts?: { silent?: boolean }) => Promise<void>
  refreshFolders: () => Promise<void>
  createDoc: (opts?: CreateDocOptions) => Promise<string | null>
  openDoc: (id: string, opts?: { ai?: boolean }) => void
  goHome: () => void

  /* tags */
  loadTags: () => Promise<void>
  setTagFilter: (id: string | null) => void
  createTag: (name: string, color?: string) => Promise<TagDTO | null>
  deleteTag: (id: string) => Promise<void>
  setDocTags: (docId: string, tagIds: string[]) => Promise<void>

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

function viewFromUrl(): { view: WorkspaceView; docId: string | null; target: AppTarget | null } {
  if (typeof window === "undefined") return { view: "home", docId: null, target: null }
  const p = new URLSearchParams(window.location.search)
  const doc = p.get("doc")
  if (doc) return { view: "editor", docId: doc, target: null }
  const app = p.get("app")
  if (app === "sheets" || app === "slides" || app === "forms") {
    const formModeRaw = p.get("mode")
    const formMode =
      app === "forms" && (formModeRaw === "fill" || formModeRaw === "responses" || formModeRaw === "edit")
        ? (formModeRaw as FormOpenMode)
        : null
    return {
      view: app,
      docId: null,
      target: { app, id: p.get("entity"), formMode },
    }
  }
  if (app === "activity") return { view: "activity", docId: null, target: null }
  if (app === "settings") return { view: "settings", docId: null, target: null }
  return { view: "home", docId: null, target: null }
}

export const useDocsStore = create<DocsState>((set, get) => ({
  view: "home",
  currentDocId: null,
  appTarget: null,
  documents: [],
  folders: [],
  tags: [],
  loading: false,
  error: null,
  searchQuery: "",
  filter: "all",
  activeFolderId: null,
  tagFilter: null,
  layout: "grid",
  openAiOnEditor: false,

  hydrateFromUrl: async () => {
    const { view, docId, target } = viewFromUrl()
    set({ view, currentDocId: docId, appTarget: target })
    await get().refresh({ silent: true })
    await get().refreshFolders()
    await get().loadTags()
  },

  bindPopState: () => {
    const onPop = () => {
      const { view, docId, target } = viewFromUrl()
      set({ view, currentDocId: docId, appTarget: target })
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

  openApp: (app, opts) => {
    // "docs" app means the Z-Docs home (document list)
    if (app === "docs") {
      get().goHome()
      return
    }
    const target: AppTarget = { app, id: opts?.id ?? null, formMode: opts?.formMode ?? null }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams({ app })
      if (target.id) params.set("entity", target.id)
      if (app === "forms" && target.formMode) params.set("mode", target.formMode)
      window.history.pushState({}, "", `/?${params.toString()}`)
    }
    set({ view: app, currentDocId: null, appTarget: target })
  },

  openActivity: () => {
    if (typeof window !== "undefined") window.history.pushState({}, "", "/?app=activity")
    set({ view: "activity", currentDocId: null, appTarget: null })
  },

  openSettings: () => {
    if (typeof window !== "undefined") window.history.pushState({}, "", "/?app=settings")
    set({ view: "settings", currentDocId: null, appTarget: null })
  },

  consumeAppTarget: () => {
    const t = get().appTarget
    set({ appTarget: null })
    return t
  },

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
      let content = opts?.content ?? template?.content ?? ""
      // workspace default font (Settings → Workspace defaults) applies to fresh blank docs
      if (!opts?.content && !template?.content) {
        try {
          if (typeof window !== "undefined" && window.localStorage.getItem("zdocs-default-font") === "serif") {
            content = '<p style="font-family: Georgia, serif"><br></p>'
          }
        } catch {
          // storage unavailable — keep plain default
        }
      }
      const body = {
        title: opts?.title ?? template?.title ?? "Untitled document",
        content,
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
    set({ view: "home", currentDocId: null, openAiOnEditor: false, appTarget: null })
    void get().refresh({ silent: true })
    void get().refreshFolders()
    void get().loadTags()
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

  /* ---------------- tags ---------------- */
  loadTags: async () => {
    try {
      const res = await fetch("/api/tags")
      if (!res.ok) return
      const data = (await res.json()) as { tags: TagDTO[] }
      set({ tags: data.tags ?? [] })
    } catch {
      // non-fatal
    }
  },

  setTagFilter: (id) => set({ tagFilter: id }),

  createTag: async (name, color) => {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { tag: TagDTO }
      await get().loadTags()
      return data.tag
    } catch {
      return null
    }
  },

  deleteTag: async (id) => {
    const prevDocs = get().documents
    set({
      tags: get().tags.filter((t) => t.id !== id),
      tagFilter: get().tagFilter === id ? null : get().tagFilter,
      documents: prevDocs.map((d) => ({ ...d, tags: (d.tags ?? []).filter((t) => t.id !== id) })),
    })
    try {
      await fetch(`/api/tags/${encodeURIComponent(id)}`, { method: "DELETE" })
    } catch {
      // ignore
    }
    await get().loadTags()
    void get().refresh({ silent: true })
  },

  setDocTags: async (docId, tagIds) => {
    const prev = get().documents
    const prevDoc = prev.find((d) => d.id === docId)
    if (!prevDoc) return
    const prevIds = (prevDoc.tags ?? []).map((t) => t.id)
    if (prevIds.length === tagIds.length && prevIds.every((id, i) => id === tagIds[i])) return
    const allTags = get().tags
    const optimisticTags = tagIds
      .map((id) => allTags.find((t) => t.id === id))
      .filter((t): t is TagDTO => !!t)
    set({ documents: prev.map((d) => (d.id === docId ? { ...d, tags: optimisticTags } : d)) })
    try {
      const res = await fetch(`/api/documents/${docId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds }),
      })
      if (!res.ok) throw new Error("set tags failed")
      const data = (await res.json()) as { tags: TagDTO[] }
      set({
        documents: get().documents.map((d) => (d.id === docId ? { ...d, tags: data.tags ?? [] } : d)),
      })
      await get().loadTags()
    } catch {
      // rollback the optimistic chip change
      set({ documents: prev.map((d) => (d.id === docId ? { ...d, tags: prevDoc.tags ?? [] } : d)) })
    }
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
    tags: doc.tags ?? [],
    snippet: getSnippet(doc.content),
    wordCount: countWords(htmlToText(doc.content)),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}
