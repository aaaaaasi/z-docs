"use client"

import { useSyncExternalStore } from "react"
import type { CollabUser } from "./docs-types"
import { colorForId } from "./doc-utils"

const KEY = "zdocs-user"

export type LocalUser = CollabUser

const SERVER_FALLBACK: LocalUser = { id: "server", name: "Guest", color: "#129c58" }

function createDefault(): LocalUser {
  const animals = ["Panda", "Falcon", "Otter", "Lynx", "Heron", "Fox", "Koala", "Ibex", "Tapir", "Marmot"]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  return {
    id: "u-" + Math.random().toString(36).slice(2, 10),
    name: "Guest " + animal,
    color: colorForId(Math.random().toString(36)),
  }
}

/* snapshot cache so useSyncExternalStore gets a stable reference */
let cached: LocalUser | null = null
let cachedRaw: string | null = null

function readUser(): LocalUser {
  const raw = window.localStorage.getItem(KEY)
  if (raw === cachedRaw && cached) return cached
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LocalUser
      if (parsed.id && parsed.name) {
        cachedRaw = raw
        cached = parsed
        return cached
      }
    } catch {
      // corrupted entry — recreate below
    }
  }
  const user = createDefault()
  try {
    window.localStorage.setItem(KEY, JSON.stringify(user))
    cachedRaw = window.localStorage.getItem(KEY)
  } catch {
    cachedRaw = null
  }
  cached = user
  return user
}

function subscribe(cb: () => void) {
  document.addEventListener("zdocs-user-changed", cb)
  window.addEventListener("storage", cb)
  return () => {
    document.removeEventListener("zdocs-user-changed", cb)
    window.removeEventListener("storage", cb)
  }
}

/** Read (or lazily create) the local identity stored in localStorage */
export function readLocalUser(): LocalUser {
  if (typeof window === "undefined") return SERVER_FALLBACK
  return readUser()
}

export function saveLocalUser(user: LocalUser) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(user))
    cachedRaw = window.localStorage.getItem(KEY)
    cached = user
  } catch {
    // ignore
  }
  document.dispatchEvent(new Event("zdocs-user-changed"))
}

/** React hook — live identity that updates when the profile changes */
export function useLocalUser(): LocalUser | null {
  return useSyncExternalStore(subscribe, readUser, () => SERVER_FALLBACK)
}
