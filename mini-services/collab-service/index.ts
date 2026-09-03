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
 *   client -> server: join-doc, leave-doc, doc-change, cursor
 *   server -> client: presence, doc-change, cursor
 */

import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'

// ---------------------------------------------------------------- types

export interface CollabUser {
  id: string // local (client) user id, NOT the socket id
  name: string
  color: string
}

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

/** Per-socket session state (keyed by socket.id). */
interface SocketSession {
  docId: string | null
  user: CollabUser | null
}

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
  sessions.set(socket.id, { docId: null, user: null })

  // ---------------------------------------------------------- join-doc
  socket.on('join-doc', (payload: JoinDocPayload) => {
    const { docId, user } = payload ?? ({} as JoinDocPayload)
    if (!docId || !user?.id) return

    // leave any previous room first (doc switching)
    const prev = sessions.get(socket.id)
    if (prev?.docId && prev.docId !== docId) {
      socket.leave(roomName(prev.docId))
      broadcastPresence(prev.docId) // refresh presence in the old room
    }

    socket.join(roomName(docId))
    sessions.set(socket.id, { docId, user })
    console.log(
      `[join] ${socket.id} -> doc:${docId} (${user.name ?? user.id})`
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
    sessions.set(socket.id, { docId: null, user: null })
    console.log(`[leave] ${socket.id} <- doc:${leftDocId}`)

    broadcastPresence(leftDocId)
  })

  // ---------------------------------------------------------- doc-change
  socket.on('doc-change', (payload: DocChangePayload) => {
    const { docId, content, title, version } = payload ?? ({} as DocChangePayload)
    if (!docId) return

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

    const broadcast: BroadcastCursor = {
      docId,
      start,
      end,
      user: session.user,
    }
    socket.to(roomName(docId)).emit('cursor', broadcast)
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

const PORT = 3003
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
