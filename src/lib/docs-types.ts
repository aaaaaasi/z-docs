export interface DocumentDTO {
  id: string
  title: string
  content: string
  starred: boolean
  trashed: boolean
  createdAt: string
  updatedAt: string
}

export interface DocumentMeta extends DocumentDTO {
  snippet: string
  wordCount: number
}

export interface VersionDTO {
  id: string
  docId: string
  title: string
  content: string
  wordCount: number
  createdAt: string
}

export interface CollabUser {
  id: string
  name: string
  color: string
}

export interface RemoteCursor {
  user: CollabUser
  start: number
  end: number
  ts: number
}

export type DocFilter = "all" | "starred" | "trash"

export interface CommentDTO {
  id: string
  docId: string
  parentId: string | null
  authorId: string
  authorName: string
  authorColor: string
  quote: string
  anchorOffset: number
  content: string
  resolved: boolean
  createdAt: string
  updatedAt: string
  replies: CommentDTO[]
}
