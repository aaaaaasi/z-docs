/**
 * Z-Docs collaboration mini-service
 * ---------------------------------
 * Socket.io server on port 3003.
 *
 * Clients connect through the Caddy gateway with:
 *   io('/?XTransformPort=3003', { transports: ['websocket', 'polling'], reconnection: true })
 * which means the socket.io engine MUST be served at path '/' (see
 * /home/z/my-project/examples/websocket/server.ts for the same pattern).
 *
 * Event contract (matches src/hooks/use-collab.ts in the Next.js app):
 *   client -> server: join-doc, leave-doc, doc-change, cursor, comments-changed
 *   server -> client: presence, doc-change, cursor, comments-changed, join-error
 *
 * REALTIME AUTHORIZATION (fail closed):
 *   Every join-doc is authorized against the Next.js app
 *   (GET /api/internal/doc-access) using the browser's forwarded session
 *   cookie plus the INTERNAL_SECRET shared secret:
 *     - access "none"  -> join rejected with a "join-error" event
 *     - access viewer  -> may join and watch presence/doc-change, but this
 *                         socket's doc-change events are DROPPED server-side
 *     - editor/owner/admin -> full read/write relay
 *   If the app (:3000) is unreachable, joins are rejected (fail closed).
 *   All relays (doc-change/cursor/comments-changed) additionally require the
 *   socket's verified session docId to match the payload docId, so a socket
 *   can never broadcast into a room it never joined.
 */

import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'

// ---------------------------------------------------------------- types

export interface CollabUser {
  id: string // local (client) user id, NOT the socket id
  name: string
  color: string
}

type AccessLevel = 'none' | 'viewer' | 'editor' | 'owner' | 'admin'

interface JoinDocPayload {
  docId: string
  user: CollabUser
}

interface DocChangePayload {
  docId: string
  content: string
  title?: string
  version: number
}

interface CursorPayload {
  docId: string
  start: number
  end: number
}

interface CommentsChangedPayload {
  docId: string
  action: 'add' | 'reply' | 'resolve' | 'unresolve' | 'delete' | 'edit' | 'react'
  commentId?: string
  by?: string
}

interface PresencePayload {
  docId: string
  users: CollabUser[]
}

interface BroadcastDocChange extends DocChangePayload {
  by: string // sender socket id, so receivers can skip their own echoes
}

interface BroadcastCursor extends CursorPayload {
  user: CollabUser
}

interface JoinErrorPayload {
  message: string
}

/** Per-socket session state (keyed by socket.id). */
interface SocketSession {
  docId: string | null
  user: CollabUser | null
  /** server-verified access level for the joined doc (null until joined) */
  access: AccessLevel | null
}

// ---------------------------------------------------------------- config

const PORT = 3003
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:3000'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? ''
const AUTH_TIMEOUT_MS = 3000

// ---------------------------------------------------------------- state

const sessions = new Map<string, SocketSession>()

const roomName = (docId: string) => `doc:${docId}`

/** Build the presence list for a room from every stored session in it. */
function presenceForRoom(docId: string): CollabUser[] {
  const room = io.sockets.adapter.rooms.get(roomName(docId))
  if (!room) return []
  const users: CollabUser[] = []
  for (const socketId of room) {
    const session = sessions.get(socketId)
    if (session?.user) users.push(session.user)
  }
  return users
}

/** Broadcast the current user list of a room to everyone in it. */
function broadcastPresence(docId: string): void {
  const payload: PresencePayload = {
    docId,
    users: presenceForRoom(docId),
  }
  io.to(roomName(docId)).emit('presence', payload)
  console.log(`[presence] doc=${docId} users=${payload.users.length}`)
}

// ---------------------------------------------------------------- realtime auth

interface DocAccessResult {
  access: AccessLevel
  user: { id: string; name: string; color: string } | null
}

const ACCESS_LEVELS: AccessLevel[] = ['viewer', 'editor', 'owner', 'admin']

/**
 * Ask the Next.js app who this socket is (via the forwarded browser cookie)
 * and what access they have to the doc. FAIL CLOSED: any error — app down,
 * non-200, malformed payload, unknown access value — yields access "none".
 */
async function fetchDocAccess(cookie: string | undefined, docId: string): Promise<DocAccessResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
    const res = await fetch(
      `${APP_ORIGIN}/api/internal/doc-access?docId=${encodeURIComponent(docId)}`,
      {
        headers: {
          ...(cookie ? { cookie } : {}),
          'x-internal-secret': INTERNAL_SECRET,
        },
        signal: controller.signal,
      }
    )
    clearTimeout(timer)
    if (!res.ok) return { access: 'none', user: null }

    const data = (await res.json().catch(() => null)) as {
      access?: string
      user?: { id?: string; name?: string; color?: string } | null
    } | null
    if (!data || !ACCESS_LEVELS.includes(data.access as AccessLevel)) {
      return { access: 'none', user: null }
    }
    const u = data.user
    const user =
      u && typeof u.id === 'string' && typeof u.name === 'string'
        ? {
            id: u.id,
            name: u.name,
            color: typeof u.color === 'string' ? u.color : '#0e7c74',
          }
        : null
    return { access: data.access as AccessLevel, user }
  } catch {
    // app unreachable / timeout / bad payload — fail closed
    return { access: 'none', user: null }
  }
}

// ---------------------------------------------------------------- server

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to route ?XTransformPort=3003 here
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket: Socket) => {
  console.log(`[connect] ${socket.id}`)
  sessions.set(socket.id, { docId: null, user: null, access: null })

  // ---------------------------------------------------------- join-doc
  socket.on('join-doc', async (payload: JoinDocPayload) => {
    const { docId, user } = payload ?? ({} as JoinDocPayload)
    // strict payload validation: docId is an opaque cuid-like string
    if (typeof docId !== 'string' || !docId || docId.length > 40) return
    if (!user || typeof user.id !== 'string') return

    // ---- realtime authorization (fail closed) ----
    const cookie = socket.request.headers.cookie
    const auth = await fetchDocAccess(cookie, docId)
    if (auth.access === 'none') {
      // no session, no access to this doc, or the auth backend is down:
      // never join the room, never announce presence
      console.log(`[join-denied] ${socket.id} -> doc:${docId}`)
      socket.emit('join-error', { message: 'No access' } satisfies JoinErrorPayload)
      return
    }

    // leave any previous room first (doc switching)
    const prev = sessions.get(socket.id)
    if (prev?.docId && prev.docId !== docId) {
      socket.leave(roomName(prev.docId))
      broadcastPresence(prev.docId) // refresh presence in the old room
    }

    socket.join(roomName(docId))
    // the presence identity is the SERVER-VERIFIED session user (falls back
    // to the client-supplied profile only when the API returned no identity)
    const presenceUser: CollabUser = auth.user ?? {
      id: user.id,
      name: user.name ?? user.id,
      color: user.color,
    }
    sessions.set(socket.id, { docId, user: presenceUser, access: auth.access })
    console.log(
      `[join] ${socket.id} -> doc:${docId} (${presenceUser.name ?? presenceUser.id}, access=${auth.access})`
    )

    // announce presence to EVERYONE in the room (including the joiner)
    broadcastPresence(docId)
  })

  // ---------------------------------------------------------- leave-doc
  socket.on('leave-doc', () => {
    const session = sessions.get(socket.id)
    if (!session?.docId) return

    const leftDocId = session.docId
    socket.leave(roomName(leftDocId))
    sessions.set(socket.id, { docId: null, user: null, access: null })
    console.log(`[leave] ${socket.id} <- doc:${leftDocId}`)

    broadcastPresence(leftDocId)
  })

  // ---------------------------------------------------------- doc-change
  socket.on('doc-change', (payload: DocChangePayload) => {
    const { docId, content, title, version } = payload ?? ({} as DocChangePayload)
    if (!docId || typeof content !== 'string') return

    const session = sessions.get(socket.id)
    // server-side authority: the socket must have VERIFIABLY joined THIS doc
    // with write access — viewers may watch, but their changes are dropped
    if (!session?.docId || session.docId !== docId) return
    if (session.access === 'viewer') {
      console.log(`[denied] viewer ${socket.id} attempted doc-change on doc:${docId}`)
      return
    }

    // sanity cap on relayed content
    if (content.length > 1_000_000) return

    const broadcast: BroadcastDocChange = {
      docId,
      content,
      title,
      version,
      by: socket.id,
    }
    // relay to everyone in the room EXCEPT the sender
    socket.to(roomName(docId)).emit('doc-change', broadcast)
  })

  // ---------------------------------------------------------- cursor
  socket.on('cursor', (payload: CursorPayload) => {
    const { docId, start, end } = payload ?? ({} as CursorPayload)
    if (!docId) return

    const session = sessions.get(socket.id)
    if (!session?.user) return // no profile yet -> ignore
    if (session.docId !== docId) return // not verified in this room -> ignore

    const broadcast: BroadcastCursor = {
      docId,
      start,
      end,
      user: session.user,
    }
    socket.to(roomName(docId)).emit('cursor', broadcast)
  })

  // ---------------------------------------------------------- comments-changed
  // A client mutated a comment (add/reply/resolve/delete) through the REST
  // API; relay a lightweight notification so other editors refetch the
  // comment list for this document. No payload data — the source of truth
  // is always the database (and the REST routes enforce access).
  socket.on('comments-changed', (payload: CommentsChangedPayload) => {
    const { docId, action, commentId } = payload ?? ({} as CommentsChangedPayload)
    if (!docId) return

    const session = sessions.get(socket.id)
    if (!session?.docId || session.docId !== docId) return // not in this room

    socket.to(roomName(docId)).emit('comments-changed', {
      docId,
      action,
      commentId,
      by: socket.id,
    })
  })

  // ---------------------------------------------------------- disconnect
  socket.on('disconnect', (reason: string) => {
    const session = sessions.get(socket.id)
    sessions.delete(socket.id)

    if (session?.docId) {
      // socket auto-leaves rooms, just refresh presence for the affected room
      console.log(
        `[disconnect] ${socket.id} (${reason}) <- doc:${session.docId}`
      )
      broadcastPresence(session.docId)
    } else {
      console.log(`[disconnect] ${socket.id} (${reason})`)
    }
  })

  socket.on('error', (err: Error) => {
    console.error(`[error] ${socket.id}:`, err.message)
  })
})

// ---------------------------------------------------------------- boot

httpServer.listen(PORT, () => {
  console.log(`collab-service (socket.io) listening on port ${PORT}`)
})

// graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing collab-service...')
  io.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('SIGINT received, closing collab-service...')
  io.close(() => process.exit(0))
})
