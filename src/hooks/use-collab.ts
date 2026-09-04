"use client"

import * as React from "react"
import { io, type Socket } from "socket.io-client"
import type { CollabUser, RemoteCursor } from "@/lib/docs-types"

export interface DocChangePayload {
  docId: string
  content: string
  title?: string
  version: number
  by: string // socket id of the sender
}

export type CommentAction = "add" | "reply" | "resolve" | "unresolve" | "delete" | "edit" | "react"

export interface CommentsChangedPayload {
  docId: string
  action: CommentAction
  commentId?: string
  by?: string
}

/**
 * Realtime collaboration client. Connects to the gateway on the mini-service
 * (port 3003) via `?XTransformPort=3003`, joins a per-document room and relays
 * presence / content changes / cursors.
 */
export function useCollab(
  docId: string | null,
  user: CollabUser | null,
  onDocChange: (p: DocChangePayload) => void,
  onCommentsChanged?: (p: CommentsChangedPayload) => void
) {
  const [connected, setConnected] = React.useState(false)
  const [myId, setMyId] = React.useState<string | null>(null)
  const [presence, setPresence] = React.useState<CollabUser[]>([])
  const [remoteCursors, setRemoteCursors] = React.useState<Record<string, RemoteCursor>>({})

  const socketRef = React.useRef<Socket | null>(null)
  const handlerRef = React.useRef(onDocChange)
  const commentsHandlerRef = React.useRef(onCommentsChanged)
  React.useEffect(() => {
    handlerRef.current = onDocChange
  }, [onDocChange])
  React.useEffect(() => {
    commentsHandlerRef.current = onCommentsChanged
  }, [onCommentsChanged])

  React.useEffect(() => {
    if (!docId || !user) return

    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
    socketRef.current = socket

    const join = () => {
      setMyId(socket.id ?? null)
      socket.emit("join-doc", { docId, user })
    }

    socket.on("connect", () => {
      setConnected(true)
      join()
    })
    socket.on("disconnect", () => setConnected(false))
    socket.on("reconnect", () => {
      setConnected(true)
      join()
    })

    socket.on("presence", (p: { docId: string; users: CollabUser[] }) => {
      if (p.docId === docId) setPresence(p.users ?? [])
    })

    socket.on("doc-change", (p: DocChangePayload) => {
      if (p.docId !== docId) return
      handlerRef.current(p)
    })

    socket.on("cursor", (c: { docId: string; start: number; end: number; user: CollabUser }) => {
      if (c.docId !== docId || !c.user || c.user.id === user.id) return
      setRemoteCursors((prev) => ({ ...prev, [c.user.id]: { user: c.user, start: c.start, end: c.end, ts: Date.now() } }))
    })

    socket.on("comments-changed", (p: CommentsChangedPayload) => {
      if (p.docId !== docId) return
      commentsHandlerRef.current?.(p)
    })

    return () => {
      try {
        socket.emit("leave-doc", {})
      } catch {
        // socket may already be closed
      }
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
      setPresence([])
      setRemoteCursors({})
    }
    // reconnect when identity (name/color) changes so presence updates
  }, [docId, user?.id, user?.name, user?.color])

  const emitDocChange = React.useCallback((content: string, title: string, version: number) => {
    const socket = socketRef.current
    if (!socket || !socket.connected || !docId) return
    socket.emit("doc-change", { docId, content, title, version })
  }, [docId])

  const emitCursor = React.useCallback((start: number, end: number) => {
    const socket = socketRef.current
    if (!socket || !socket.connected || !docId) return
    socket.emit("cursor", { docId, start, end })
  }, [docId])

  const emitCommentsChanged = React.useCallback((action: CommentAction, commentId?: string) => {
    const socket = socketRef.current
    if (!socket || !socket.connected || !docId) return
    socket.emit("comments-changed", { docId, action, commentId })
  }, [docId])

  // prune stale remote cursors (user inactive > 8s)
  React.useEffect(() => {
    const t = setInterval(() => {
      setRemoteCursors((prev) => {
        const now = Date.now()
        const next: Record<string, RemoteCursor> = {}
        let changed = false
        for (const [id, c] of Object.entries(prev)) {
          if (now - c.ts < 8000) next[id] = c
          else changed = true
        }
        return changed ? next : prev
      })
    }, 2000)
    return () => clearInterval(t)
  }, [])

  return { connected, myId, presence, remoteCursors, emitDocChange, emitCursor, emitCommentsChanged }
}
