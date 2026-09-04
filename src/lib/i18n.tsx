"use client"

import * as React from "react"
import { dictCommon } from "./i18n/dict-common"
import { dictHome } from "./i18n/dict-home"
import { dictEditor } from "./i18n/dict-editor"
import { dictSheets } from "./i18n/dict-sheets"
import { dictSlides } from "./i18n/dict-slides"
import { dictForms } from "./i18n/dict-forms"
import { dictApps } from "./i18n/dict-apps"

export type Lang = "en" | "zh"

export const LANG_STORAGE_KEY = "zdocs-lang"

/** All zh dictionaries merged (later groups may override duplicates — keep translations consistent). */
const zhDict: Record<string, string> = {
  ...dictCommon,
  ...dictHome,
  ...dictEditor,
  ...dictSheets,
  ...dictSlides,
  ...dictForms,
  ...dictApps,
}

/** BCP-47 locale for Intl formatting. */
export function localeOf(lang: Lang): string {
  return lang === "zh" ? "zh-CN" : "en-US"
}

/**
 * Non-React read of the current language (localStorage, default zh).
 * For zustand-store actions, event handlers and other imperative code.
 * React components should use useI18n() so they re-render on change.
 */
export function getCurrentLang(): Lang {
  if (typeof window === "undefined") return "zh"
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY)
    return stored === "en" ? "en" : "zh"
  } catch {
    return "zh"
  }
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m
  )
}

/**
 * Pure translation lookup — safe outside React (utils, event handlers, effects).
 * The KEY is the English source string; zh translations come from the dictionaries.
 * Unknown keys gracefully fall back to English. `{name}` placeholders are interpolated.
 */
export function tForLang(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>
): string {
  if (lang === "zh") {
    const zh = zhDict[key]
    if (zh !== undefined) return interpolate(zh, params)
  }
  return interpolate(key, params)
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** t("File") → "文件" when zh; t("{n} of {total}", {n: 1, total: 5}) interpolates. */
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

/**
 * Mounts once at the app root (DocsApp). Default language is Chinese ("全部增加中文翻译"),
 * persisted choice is re-applied after mount to avoid SSR hydration mismatch.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("zh")

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANG_STORAGE_KEY)
      if (stored === "en" || stored === "zh") setLangState(stored)
    } catch {
      /* private mode */
    }
  }, [])

  React.useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"
  }, [lang])

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next)
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next)
    } catch {
      /* private mode */
    }
  }, [])

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) => tForLang(lang, key, params),
    [lang]
  )

  const value = React.useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>")
  return ctx
}
