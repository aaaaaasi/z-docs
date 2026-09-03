"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { FileText, Sparkles } from "lucide-react"

export function WordCountDialog({
  open, onOpenChange, stats,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  stats: { words: number; chars: number; paragraphs: number; pages: number; readingMinutes: number }
}) {
  const rows: [string, string | number][] = [
    ["Pages", stats.pages],
    ["Words", stats.words.toLocaleString()],
    ["Characters", stats.chars.toLocaleString()],
    ["Paragraphs", stats.paragraphs.toLocaleString()],
    ["Reading time", `~${stats.readingMinutes} min`],
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Word count</DialogTitle>
          <DialogDescription>Live statistics for this document.</DialogDescription>
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
  ["Ctrl / ⌘ + F", "Find and replace"],
  ["Ctrl / ⌘ + Alt / ⌥ + M", "Add comment on selection"],
  ["Ctrl / ⌘ + S", "Save now"],
  ["Ctrl / ⌘ + P", "Print"],
  ["Ctrl / ⌘ + Z", "Undo"],
  ["Ctrl / ⌘ + Y", "Redo"],
  ["Ctrl / ⌘ + \\", "Clear formatting"],
  ["Ctrl / ⌘ + Enter", "Generate AI draft (in Help me write)"],
  ["Ctrl / ⌘ + Enter", "Post comment / reply (in comment forms)"],
  ["Esc", "Close dialogs"],
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto pr-1 slim-scroll">
          <table className="w-full text-sm">
            <tbody>
              {SHORTCUTS.map(([k, v]) => (
                <tr key={k} className="border-b last:border-b-0">
                  <td className="py-2">
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd>
                  </td>
                  <td className="py-2.5 text-muted-foreground">{v}</td>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            About Z-Docs
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Z-Docs is a Google&nbsp;Docs-style collaborative document editor. It features a rich text
            toolbar, autosave, version history, real-time presence, live cursors and an AI writing assistant.
          </p>
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /> AI drafting</div>
            <div>Real-time collaboration</div>
            <div>Version history</div>
            <div>Templates gallery</div>
            <div>Trash &amp; stars</div>
            <div>Print &amp; export</div>
          </div>
          <Separator />
          <p className="text-xs">Built with Next.js 16, Prisma, Socket.IO and Tailwind CSS.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
