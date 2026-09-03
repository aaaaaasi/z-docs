"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Link2 } from "lucide-react"

/* ---------------- Link dialog ---------------- */

export function LinkDialog({
  open, onOpenChange, onInsert, hasSelection,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onInsert: (url: string, text: string) => void
  hasSelection: boolean
}) {
  const [text, setText] = React.useState("")
  const [url, setUrl] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setText("")
      setUrl("")
    }
  }, [open])

  const valid = /^https?:\/\/\S+$/i.test(url.trim()) || /^mailto:\S+@\S+$/i.test(url.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
        </DialogHeader>
        {!hasSelection && (
          <div className="space-y-2">
            <Label htmlFor="link-text">Text</Label>
            <Input
              id="link-text"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Text to display"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="link-url">URL</Label>
          <Input
            id="link-url"
            autoFocus={hasSelection}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid && (hasSelection || text.trim())) {
                const url2 = url.trim()
                const text2 = text.trim()
                onOpenChange(false)
                setTimeout(() => onInsert(url2, text2), 220)
              }
            }}
          />
          {url.trim() && !valid && (
            <p className="text-xs text-destructive">Enter a valid URL starting with http:// or https://</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!valid || (!hasSelection && !text.trim())}
            onClick={() => {
              const url2 = url.trim()
              const text2 = text.trim()
              onOpenChange(false)
              // wait for the modal focus-trap to release before inserting
              setTimeout(() => onInsert(url2, text2), 220)
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Image dialog ---------------- */

export function ImageDialog({
  open, onOpenChange, onInsert,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onInsert: (src: string, alt: string) => void
}) {
  const [url, setUrl] = React.useState("")
  const [alt, setAlt] = React.useState("")
  const [fileSrc, setFileSrc] = React.useState("")
  const [fileName, setFileName] = React.useState("")
  const { toast } = useToast()

  React.useEffect(() => {
    if (open) {
      setUrl("")
      setAlt("")
      setFileSrc("")
      setFileName("")
    }
  }, [open])

  const onFile = (f: File | undefined) => {
    if (!f) return
    if (f.size > 2.5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please pick an image under 2.5 MB.", variant: "destructive" })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setFileSrc(String(reader.result))
      setFileName(f.name)
    }
    reader.readAsDataURL(f)
  }

  const ready = (url.trim() && /^https?:\/\//i.test(url.trim())) || fileSrc

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="by-url">
          <TabsList className="w-full">
            <TabsTrigger value="by-url" className="flex-1">From URL</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="by-url" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="img-url">Image URL</Label>
              <Input
                id="img-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />
            </div>
          </TabsContent>
          <TabsContent value="upload" className="space-y-2 pt-2">
            <Label htmlFor="img-file">Choose a file (≤ 2.5 MB)</Label>
            <Input id="img-file" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
            {fileSrc && (
              <div className="mt-2 space-y-1">
                <img src={fileSrc} alt="preview" className="max-h-36 rounded border" />
                <p className="text-xs text-muted-foreground">{fileName}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
        <div className="space-y-2">
          <Label htmlFor="img-alt">Alt text (optional)</Label>
          <Input id="img-alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!ready}
            onClick={() => {
              const src = url.trim() || fileSrc
              const alt2 = alt.trim()
              onOpenChange(false)
              setTimeout(() => onInsert(src, alt2), 220)
            }}
          >
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Table dialog ---------------- */

const GRID_MAX = 8

export function TableDialog({
  open, onOpenChange, onInsert,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onInsert: (rows: number, cols: number) => void
}) {
  const [hover, setHover] = React.useState({ rows: 0, cols: 0 })

  React.useEffect(() => {
    if (open) setHover({ rows: 0, cols: 0 })
  }, [open])

  const pick = (rows: number, cols: number) => {
    onOpenChange(false)
    // let the Radix overlay release focus before mutating the editor
    setTimeout(() => onInsert(rows, cols), 220)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Insert table</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <div className="flex flex-col gap-1" onMouseLeave={() => setHover({ rows: 0, cols: 0 })} role="grid" aria-label="Table size picker">
            {Array.from({ length: GRID_MAX }).map((_, r) => (
              <div key={r} className="flex gap-1">
                {Array.from({ length: GRID_MAX }).map((_, c) => {
                  const on = r < hover.rows && c < hover.cols
                  return (
                    <button
                      key={c}
                      aria-label={`Insert ${r + 1} by ${c + 1} table`}
                      onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })}
                      onClick={() => pick(r + 1, c + 1)}
                      className={`h-7 w-7 rounded-[3px] border transition-[background-color,border-color,transform] ${
                        on ? "border-primary bg-primary/70 scale-105" : "border-border bg-muted/60 hover:bg-muted"
                      }`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-sm tabular-nums text-muted-foreground" role="status">
          {hover.rows > 0 ? `${hover.rows} × ${hover.cols} table` : "Hover to pick a size, click to insert"}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
