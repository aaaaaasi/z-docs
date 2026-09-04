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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CollabUser } from "@/lib/docs-types"
import { initialsOf, colorForId } from "@/lib/doc-utils"
import { api } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Copy, Check, Globe, Lock, UserPlus, X } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface CollaboratorRow {
  id: string
  email: string
  name: string
  color: string
  role: string
  createdAt: string
}

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
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState("viewer")
  const [inviteBusy, setInviteBusy] = React.useState(false)
  const [collaborators, setCollaborators] = React.useState<CollaboratorRow[]>([])
  const { toast } = useToast()
  const { t } = useI18n()
  const link = typeof window !== "undefined" ? `${window.location.origin}/?doc=${docId}` : `/?doc=${docId}`

  // load saved collaborators whenever the dialog opens
  React.useEffect(() => {
    if (!open || !docId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/collaborators`)
        if (!res.ok) return
        const data = (await res.json()) as { collaborators: CollaboratorRow[] }
        if (!cancelled) setCollaborators(data.collaborators ?? [])
      } catch {
        // non-fatal
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, docId])

  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: t("Enter a valid email address"), variant: "destructive" })
      return
    }
    setInviteBusy(true)
    try {
      const res = await api(`/api/documents/${encodeURIComponent(docId)}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? t("Invite failed"))
      }
      const data = (await res.json()) as { collaborator: CollaboratorRow }
      setCollaborators((prev) => {
        const rest = prev.filter((c) => c.email !== data.collaborator.email)
        return [...rest, data.collaborator].sort((a, b) => a.email.localeCompare(b.email))
      })
      setInviteEmail("")
      toast({
        title: t("Shared with {email}", { email: data.collaborator.email }),
        description: data.collaborator.role === "editor"
          ? t("They can edit this document.")
          : t("They can view this document."),
      })
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("Invite failed"), variant: "destructive" })
    } finally {
      setInviteBusy(false)
    }
  }

  const removeCollaborator = async (email: string) => {
    setCollaborators((prev) => prev.filter((c) => c.email !== email))
    try {
      await api(`/api/documents/${encodeURIComponent(docId)}/collaborators?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      })
      toast({ title: t("Removed {email}", { email }) })
    } catch {
      toast({ title: t("Couldn't remove access"), variant: "destructive" })
    }
  }

  const changeRole = async (email: string, role: string) => {
    setCollaborators((prev) => prev.map((c) => (c.email === email ? { ...c, role } : c)))
    try {
      await api(`/api/documents/${encodeURIComponent(docId)}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
    } catch {
      // rollback silently
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast({ title: t("Link copied to clipboard") })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: t("Couldn't copy the link"), variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Share “{title}”", { title: title || t("Untitled document") })}</DialogTitle>
          <DialogDescription>
            {t("Anyone with the link can open this document and edit it live with you.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="share-link">{t("Document link")}</Label>
          <div className="flex items-center gap-2">
            <Input id="share-link" readOnly value={link} className="h-10 bg-muted font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button size="sm" className="h-10 gap-1.5 px-4" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("Copied") : t("Copy")}
            </Button>
          </div>
        </div>

        <Separator />

        <div>
          <Label className="text-sm font-medium">{t("People with access")}</Label>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3 rounded-lg border p-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: me.color }}
              >
                {initialsOf(me.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t("{name} (you)", { name: me.name })}</p>
                <p className="text-xs text-muted-foreground">{t("local account")}</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{t("Owner")}</span>
            </div>
            {collaborators.map((c) => (
              <div key={c.email} className="group flex items-center gap-3 rounded-lg border p-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: c.color || colorForId(c.email) }}
                >
                  {initialsOf(c.name || c.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name || c.email.split("@")[0]}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={t("Change role for {email}", { email: c.email })}
                      className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {c.role === "editor" ? t("Editor") : t("Viewer")}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => void changeRole(c.email, "viewer")}>
                      <Lock className="h-4 w-4" /> {t("Viewer")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void changeRole(c.email, "editor")}>
                      <UserPlus className="h-4 w-4" /> {t("Editor")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => void removeCollaborator(c.email)}
                    >
                      <X className="h-4 w-4" /> {t("Remove access")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
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
                    <p className="text-xs text-emerald-600">{t("editing now")}</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{t("Editor")}</span>
                </div>
              ))}
            {presence.length <= 1 && collaborators.length === 0 && (
              <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                {t("Invite someone by email, or open the link in another tab to collaborate in real time.")}
              </p>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          {access === "link" ? <Globe className="h-5 w-5 text-muted-foreground" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
          <div className="flex-1">
            <p className="text-sm font-medium">{t("General access")}</p>
            <p className="text-xs text-muted-foreground">
              {access === "link" ? t("Anyone on this network with the link") : t("Restricted, only people with access")}
            </p>
          </div>
          <Select value={access} onValueChange={setAccess}>
            <SelectTrigger className="h-9 w-[150px]" aria-label={t("General access")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="link">{t("Anyone with link")}</SelectItem>
              <SelectItem value="restricted">{t("Restricted")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-dashed p-2.5">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void invite()}
            placeholder={t("Add people by email")}
            aria-label={t("Invite by email")}
            className="h-8 border-transparent bg-transparent text-sm"
          />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="h-8 w-[110px] shrink-0 border-transparent bg-transparent text-xs" aria-label={t("Invite role")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">{t("Viewer")}</SelectItem>
              <SelectItem value="editor">{t("Editor")}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 shrink-0 px-4" disabled={inviteBusy || !inviteEmail.trim()} onClick={() => void invite()}>
            {inviteBusy ? t("Sharing…") : t("Share")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
