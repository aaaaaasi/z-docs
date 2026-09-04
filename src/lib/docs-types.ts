export interface DocumentDTO {
  id: string
  title: string
  content: string
  starred: boolean
  trashed: boolean
  folderId?: string | null
  /** labels attached to this document (present in list/detail GETs) */
  tags?: TagDTO[]
  createdAt: string
  updatedAt: string
}

export interface TagDTO {
  id: string
  name: string
  color: string
  /** number of documents carrying this tag (only in /api/tags responses) */
  count?: number
  createdAt?: string
  updatedAt?: string
}

export interface DocumentMeta extends DocumentDTO {
  snippet: string
  wordCount: number
}

export interface FolderDTO {
  id: string
  name: string
  color: string
  count?: number
  createdAt: string
  updatedAt: string
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

export type DocFilter = "all" | "starred" | "trash" | "folder"

export interface CommentReactionDTO {
  id: string
  commentId: string
  userId: string
  userName: string
  emoji: string
}

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
  reactions: CommentReactionDTO[]
}
