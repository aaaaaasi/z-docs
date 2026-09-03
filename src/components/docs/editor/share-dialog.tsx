"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import type { CollabUser } from "@/lib/docs-types"
import { initialsOf } from "@/lib/doc-utils"
import { useToast } from "@/hooks/use-toast"
import { Copy, Check, Globe, Lock, UserPlus } from "lucide-react"

export function ShareDialog({
  open, onOpenChange, docId, title, presence, me,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  docId: string
  title: string
  presence: CollabUser[]
  me: { name: string; color: string }
}) {
  const [copied, setCopied] = React.useState(false)
  const [access, setAccess] = React.useState("link")
  const { toast } = useToast()
  const link = typeof window !== "undefined" ? `${window.location.origin}/?doc=${docId}` : `/?doc=${docId}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast({ title: "Link copied to clipboard" })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: "Couldn't copy the link", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{title || "Untitled document"}”</DialogTitle>
          <DialogDescription>
            Anyone with the link can open this document and edit it live with you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="share-link">Document link</Label>
          <div className="flex items-center gap-2">
            <Input id="share-link" readOnly value={link} className="h-10 bg-muted font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button size="sm" className="h-10 gap-1.5 px-4" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <Separator />

        <div>
          <Label className="text-sm font-medium">People with access</Label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3 rounded-lg border p-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: me.color }}
              >
                {initialsOf(me.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{me.name} (you)</p>
                <p className="text-xs text-muted-foreground">local account</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">Owner</span>
            </div>
            {presence
              .filter((u) => u.name !== me.name)
              .slice(0, 5)
              .map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: u.color }}
                  >
                    {initialsOf(u.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-emerald-600">editing now</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Editor</span>
                </div>
              ))}
            {presence.length <= 1 && (
              <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                Open the link in another browser tab or window to collaborate in real time.
              </p>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          {access === "link" ? <Globe className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
          <div className="flex-1">
            <p className="text-sm font-medium">General access</p>
            <p className="text-xs text-muted-foreground">
              {access === "link" ? "Anyone on this network with the link" : "Restricted — only people with access"}
            </p>
          </div>
          <Select value={access} onValueChange={setAccess}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="General access">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="link">Anyone with link</SelectItem>
              <SelectItem value="restricted">Restricted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-dashed p-2.5 text-muted-foreground">
          <UserPlus className="h-4 w-4" />
          <Input disabled placeholder="Invite by email — coming soon" className="h-8 border-transparent bg-transparent text-sm" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
