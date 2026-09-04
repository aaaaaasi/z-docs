"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { FileText, Sparkles } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export function WordCountDialog({
  open, onOpenChange, stats,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  stats: { words: number; chars: number; paragraphs: number; pages: number; readingMinutes: number }
}) {
  const { t } = useI18n()
  const rows: [string, string | number][] = [
    [t("Pages"), stats.pages],
    [t("Words"), stats.words.toLocaleString()],
    [t("Characters"), stats.chars.toLocaleString()],
    [t("Paragraphs"), stats.paragraphs.toLocaleString()],
    [t("Reading time"), t("~{n} min", { n: stats.readingMinutes })],
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Word count")}</DialogTitle>
          <DialogDescription>{t("Live statistics for this document.")}</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b last:border-b-0">
                <td className="py-2.5 text-muted-foreground">{k}</td>
                <td className="py-2.5 text-right font-medium tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}

const SHORTCUTS: [string, string][] = [
  ["Ctrl / ⌘ + B", "Bold"],
  ["Ctrl / ⌘ + I", "Italic"],
  ["Ctrl / ⌘ + U", "Underline"],
  ["Ctrl / ⌘ + K", "Insert link"],
  ["Ctrl / ⌘ + Shift + T", "Insert table"],
  ["Ctrl / ⌘ + F", "Find in document"],
  ["Ctrl / ⌘ + H", "Find and replace"],
  ["Enter / Shift + Enter", "Next / previous match (in find bar)"],
  ["Ctrl / ⌘ + Alt / ⌥ + M", "Add comment on selection"],
  ["Ctrl / ⌘ + Alt / ⌥ + A", "AI polish: selection or whole document"],
  ["Ctrl / ⌘ + Shift + S", "Voice typing (start / stop)"],
  ["Ctrl / ⌘ + S", "Save now"],
  ["Ctrl / ⌘ + P", "Print"],
  ["Ctrl / ⌘ + Z", "Undo"],
  ["Ctrl / ⌘ + Y", "Redo"],
  ["Ctrl / ⌘ + \\", "Clear formatting"],
  ["Ctrl / ⌘ + Enter", "Generate AI draft (in Help me write)"],
  ["Ctrl / ⌘ + Enter", "Post comment / reply (in comment forms)"],
  ["Esc", "Close dialogs or find bar"],
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Keyboard shortcuts")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto pr-1 slim-scroll">
          <table className="w-full text-sm">
            <tbody>
              {SHORTCUTS.map(([k, v]) => (
                <tr key={k} className="border-b last:border-b-0">
                  <td className="py-2">
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd>
                  </td>
                  <td className="py-2.5 text-muted-foreground">{t(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            {t("About Z-Docs")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            {t("Z-Docs is a Google Docs-style collaborative document editor. It features a rich text toolbar, autosave, version history, real-time presence, live cursors and an AI writing assistant.")}
          </p>
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /> {t("AI drafting")}</div>
            <div>{t("Real-time collaboration")}</div>
            <div>{t("Version history")}</div>
            <div>{t("Templates gallery")}</div>
            <div>{t("Trash & stars")}</div>
            <div>{t("Print & export")}</div>
          </div>
          <Separator />
          <p className="text-xs">{t("Built with Next.js 16, Prisma, Socket.IO and Tailwind CSS.")}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
