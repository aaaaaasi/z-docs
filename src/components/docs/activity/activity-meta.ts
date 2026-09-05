import type { LucideIcon } from "lucide-react"
import {
  ClipboardCheck,
  Copy,
  FileSpreadsheet,
  FileText,
  FormInput,
  History,
  MessageSquare,
  Pencil,
  Plus,
  Presentation,
  Share2,
  Star,
  Tag,
  Trash2,
} from "lucide-react"
import type { ActivityKind, WorkspaceApp } from "@/lib/workspace-types"

/** Brand metadata for the four Z workspace apps (colors are deliberately
 *  teal / green / amber / rose — no blues). */
export interface AppMeta {
  label: string
  /** short label for filter chips */
  chip: string
  icon: LucideIcon
  /** solid brand color used for badges and tiles */
  color: string
}

export const APP_META: Record<WorkspaceApp, AppMeta> = {
  docs: { label: "Z-Docs", chip: "Docs", icon: FileText, color: "#0b6b62" },
  sheets: { label: "Z-Sheets", chip: "Sheets", icon: FileSpreadsheet, color: "#1f7a3f" },
  slides: { label: "Z-Slides", chip: "Slides", icon: Presentation, color: "#b26a00" },
  forms: { label: "Z-Forms", chip: "Forms", icon: FormInput, color: "#a8435a" },
}

/** Display metadata per activity kind — the verb reads naturally before the
 *  quoted entity title ("You created “Q3 Report”"). */
export interface KindMeta {
  verb: string
  icon: LucideIcon
  /** render the icon filled (starred) */
  filled?: boolean
}

export const KIND_META: Record<ActivityKind, KindMeta> = {
  created: { verb: "created", icon: Plus },
  edited: { verb: "edited", icon: Pencil },
  renamed: { verb: "renamed", icon: Tag },
  starred: { verb: "starred", icon: Star, filled: true },
  unstarred: { verb: "unstarred", icon: Star },
  trashed: { verb: "trashed", icon: Trash2 },
  restored: { verb: "restored", icon: History },
  duplicated: { verb: "duplicated", icon: Copy },
  commented: { verb: "commented on", icon: MessageSquare },
  submitted: { verb: "responded to", icon: ClipboardCheck },
  shared: { verb: "shared", icon: Share2 },
}
