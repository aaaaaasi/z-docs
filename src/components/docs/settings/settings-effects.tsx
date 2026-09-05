"use client"

import * as React from "react"
import { applyAccent, readStoredAccent } from "./settings-lib"

/**
 * Mount-once side effect, rendered at the app root:
 * applies the persisted workspace accent on load and re-applies it whenever
 * the light/dark theme flips (the dark variant is a lightened accent).
 * Renders nothing.
 */
export function SettingsEffects() {
  React.useEffect(() => {
    const sync = () => {
      const hex = readStoredAccent()
      if (hex) applyAccent(hex)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return null
}
