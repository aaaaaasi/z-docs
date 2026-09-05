"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { getCurrentLang, tForLang } from "@/lib/i18n"
import type { FormMeta } from "@/lib/workspace-types"
import {
  apiCreateForm,
  apiDeleteForm,
  apiGetForm,
  apiListForms,
  apiPatchForm,
  questionsToData,
  type ListTab,
} from "./forms-utils"

/**
 * Owns the Z-Forms list mode data: fetching per tab/search plus every
 * card-level mutation (rename / star / duplicate / trash / restore / delete).
 */
export function useFormsList() {
  const { toast } = useToast()

  /* imperative translate helper (hook callbacks are non-component code — see i18n contract) */
  const tr = React.useCallback(
    (key: string, params?: Record<string, string | number>) => tForLang(getCurrentLang(), key, params),
    []
  )

  const [forms, setForms] = React.useState<FormMeta[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tab, setTabState] = React.useState<ListTab>("all")
  const [search, setSearchState] = React.useState("")

  /* latest-value refs read by the async callbacks below */
  const tabRef = React.useRef<ListTab>("all")
  const searchRef = React.useRef("")
  const formsRef = React.useRef<FormMeta[]>([])
  React.useEffect(() => {
    tabRef.current = tab
    searchRef.current = search
    formsRef.current = forms
  }, [tab, search, forms])

  const load = React.useCallback(
    async (t: ListTab = tabRef.current, q: string = searchRef.current) => {
      setLoading(true)
      setError(null)
      try {
        const list = await apiListForms(t, q)
        setForms(list)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /* fresh fetch on every mount of the list view (returning from builder too) */
  React.useEffect(() => {
    void load()
  }, [load])

  const setTab = React.useCallback(
    (t: ListTab) => {
      setTabState(t)
      tabRef.current = t
      void load(t, searchRef.current)
    },
    [load]
  )

  const applySearch = React.useCallback(
    (q: string) => {
      setSearchState(q)
      searchRef.current = q
      void load(tabRef.current, q)
    },
    [load]
  )

  const reload = React.useCallback(() => void load(), [load])

  const renameForm = React.useCallback(
    async (id: string, title: string) => {
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, title } : f)))
      try {
        await apiPatchForm(id, { title })
      } catch {
        toast({ title: tr("Rename failed"), variant: "destructive" })
        void load()
      }
    },
    [load, toast, tr]
  )

  const toggleStar = React.useCallback(
    async (id: string) => {
      const target = formsRef.current.find((f) => f.id === id)
      if (!target) return
      const next = !target.starred
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, starred: next } : f)))
      try {
        await apiPatchForm(id, { starred: next })
      } catch {
        toast({ title: tr("Couldn't update star"), variant: "destructive" })
        void load()
      }
    },
    [load, toast, tr]
  )

  const duplicateForm = React.useCallback(
    async (id: string) => {
      const target = formsRef.current.find((f) => f.id === id)
      if (!target) return
      try {
        const full = await apiGetForm(id)
        const copyTitle = tr("Copy of {title}", { title: target.title })
        await apiCreateForm({
          title: copyTitle,
          description: full.description,
          data: questionsToData(full.questions),
        })
        toast({ title: tr("Form duplicated"), description: tr("“{title}” was added to your forms.", { title: copyTitle }) })
        await load()
      } catch {
        toast({ title: tr("Duplicate failed"), variant: "destructive" })
      }
    },
    [load, toast, tr]
  )

  const setTrashed = React.useCallback(
    async (id: string, trashed: boolean) => {
      const target = formsRef.current.find((f) => f.id === id)
      try {
        await apiPatchForm(id, { trashed })
        toast({
          title: trashed ? tr("Moved to trash") : tr("Restored"),
          description: trashed
            ? tr("“{title}” was moved to trash.", { title: target?.title ?? tr("Form") })
            : tr("“{title}” was restored.", { title: target?.title ?? tr("Form") }),
        })
        await load()
      } catch {
        toast({ title: trashed ? tr("Couldn't move to trash") : tr("Restore failed"), variant: "destructive" })
        void load()
      }
    },
    [load, toast, tr]
  )

  const deleteForever = React.useCallback(
    async (id: string) => {
      const target = formsRef.current.find((f) => f.id === id)
      try {
        await apiDeleteForm(id)
        toast({ title: tr("Deleted forever"), description: tr("“{title}” was permanently deleted.", { title: target?.title ?? tr("Form") }) })
        await load()
      } catch {
        toast({ title: tr("Delete failed"), variant: "destructive" })
        void load()
      }
    },
    [load, toast, tr]
  )

  return {
    forms,
    loading,
    error,
    tab,
    search,
    setTab,
    applySearch,
    reload,
    renameForm,
    toggleStar,
    duplicateForm,
    setTrashed,
    deleteForever,
  }
}
