"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Smile, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmojiDef {
  emoji: string
  name: string
}

interface EmojiCategory {
  id: string
  label: string
  emojis: EmojiDef[]
}

const CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      { emoji: "😀", name: "grinning" },
      { emoji: "😃", name: "smiley" },
      { emoji: "😄", name: "smile" },
      { emoji: "😁", name: "grin" },
      { emoji: "😆", name: "laughing" },
      { emoji: "😅", name: "sweat smile" },
      { emoji: "🤣", name: "rofl" },
      { emoji: "😂", name: "joy tears" },
      { emoji: "🙂", name: "slight smile" },
      { emoji: "🙃", name: "upside down" },
      { emoji: "😉", name: "wink" },
      { emoji: "😊", name: "blush" },
      { emoji: "😇", name: "halo angel" },
      { emoji: "🥰", name: "love hearts" },
      { emoji: "😍", name: "heart eyes" },
      { emoji: "🤩", name: "star struck" },
      { emoji: "😘", name: "kiss" },
      { emoji: "😗", name: "kissing" },
      { emoji: "😋", name: "yum tasty" },
      { emoji: "😛", name: "tongue" },
      { emoji: "🤔", name: "thinking" },
      { emoji: "🤨", name: "raised eyebrow" },
      { emoji: "😐", name: "neutral" },
      { emoji: "🙄", name: "eye roll" },
      { emoji: "😴", name: "sleep" },
      { emoji: "🤯", name: "mind blown" },
      { emoji: "🥳", name: "party celebrate" },
      { emoji: "😎", name: "cool sunglasses" },
      { emoji: "🤓", name: "nerd" },
      { emoji: "😭", name: "cry sob" },
      { emoji: "😢", name: "cry sad" },
      { emoji: "😤", name: "steam nose" },
      { emoji: "😡", name: "angry mad" },
      { emoji: "🤗", name: "hug" },
      { emoji: "🤭", name: "hand mouth oops" },
      { emoji: "😅", name: "relieved" },
    ],
  },
  {
    id: "people",
    label: "People",
    emojis: [
      { emoji: "👍", name: "thumbs up yes" },
      { emoji: "👎", name: "thumbs down no" },
      { emoji: "👌", name: "ok" },
      { emoji: "✌️", name: "peace victory" },
      { emoji: "🤞", name: "fingers crossed" },
      { emoji: "🤟", name: "love you" },
      { emoji: "🤘", name: "rock" },
      { emoji: "👏", name: "clap applause" },
      { emoji: "🙌", name: "raised hands hooray" },
      { emoji: "🫶", name: "heart hands" },
      { emoji: "🤝", name: "handshake deal" },
      { emoji: "🙏", name: "pray thanks please" },
      { emoji: "💪", name: "muscle strong" },
      { emoji: "👋", name: "wave hello" },
      { emoji: "🫡", name: "salute" },
      { emoji: "✍️", name: "write" },
      { emoji: "👀", name: "eyes look" },
      { emoji: "🧠", name: "brain" },
      { emoji: "🫂", name: "people hugging" },
      { emoji: "💼", name: "briefcase work" },
    ],
  },
  {
    id: "objects",
    label: "Objects",
    emojis: [
      { emoji: "📄", name: "page document" },
      { emoji: "📋", name: "clipboard" },
      { emoji: "📌", name: "pin" },
      { emoji: "📎", name: "paperclip attachment" },
      { emoji: "🗂️", name: "folders" },
      { emoji: "📅", name: "calendar date" },
      { emoji: "⏰", name: "alarm clock" },
      { emoji: "⏳", name: "hourglass waiting" },
      { emoji: "✅", name: "check done task complete" },
      { emoji: "☑️", name: "checkbox checked" },
      { emoji: "❌", name: "cross no wrong" },
      { emoji: "⚠️", name: "warning caution" },
      { emoji: "❗", name: "exclamation important" },
      { emoji: "❓", name: "question" },
      { emoji: "💡", name: "idea light bulb" },
      { emoji: "🔔", name: "bell notification" },
      { emoji: "🔍", name: "search magnify find" },
      { emoji: "🔒", name: "lock private" },
      { emoji: "🔑", name: "key" },
      { emoji: "💰", name: "money budget" },
      { emoji: "📊", name: "chart data growth" },
      { emoji: "📈", name: "chart increasing" },
      { emoji: "📉", name: "chart decreasing" },
      { emoji: "🎯", name: "target goal" },
      { emoji: "🏆", name: "trophy win" },
      { emoji: "🚀", name: "rocket launch fast" },
      { emoji: "🔥", name: "fire hot" },
      { emoji: "⭐", name: "star favorite" },
      { emoji: "✨", name: "sparkles new" },
      { emoji: "🎉", name: "party celebrate tada" },
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    emojis: [
      { emoji: "➡️", name: "arrow right" },
      { emoji: "⬅️", name: "arrow left" },
      { emoji: "⬆️", name: "arrow up" },
      { emoji: "⬇️", name: "arrow down" },
      { emoji: "↔️", name: "arrow left right" },
      { emoji: "↩️", name: "arrow return" },
      { emoji: "♾️", name: "infinity" },
      { emoji: "©️", name: "copyright" },
      { emoji: "®️", name: "registered" },
      { emoji: "™️", name: "trademark" },
      { emoji: "§", name: "section" },
      { emoji: "¶", name: "pilcrow paragraph" },
      { emoji: "†", name: "dagger" },
      { emoji: "•", name: "bullet" },
      { emoji: "…", name: "ellipsis" },
      { emoji: "‰", name: "per mille" },
      { emoji: "€", name: "euro" },
      { emoji: "£", name: "pound" },
      { emoji: "¥", name: "yen" },
      { emoji: "°", name: "degree" },
      { emoji: "±", name: "plus minus" },
      { emoji: "×", name: "multiply" },
      { emoji: "÷", name: "divide" },
      { emoji: "≈", name: "almost equal" },
      { emoji: "≠", name: "not equal" },
      { emoji: "≤", name: "less equal" },
      { emoji: "≥", name: "greater equal" },
      { emoji: "√", name: "square root" },
      { emoji: "∑", name: "sum" },
      { emoji: "π", name: "pi" },
      { emoji: "∞", name: "infinity symbol" },
      { emoji: "½", name: "half fraction" },
      { emoji: "¼", name: "quarter fraction" },
      { emoji: "¾", name: "three quarter" },
    ],
  },
  {
    id: "nature",
    label: "Nature",
    emojis: [
      { emoji: "🌱", name: "seedling growth" },
      { emoji: "🌿", name: "herb leaf" },
      { emoji: "🍀", name: "clover lucky" },
      { emoji: "🌈", name: "rainbow" },
      { emoji: "☀️", name: "sun sunny" },
      { emoji: "🌙", name: "moon night" },
      { emoji: "☁️", name: "cloud" },
      { emoji: "⚡", name: "lightning fast" },
      { emoji: "❄️", name: "snow winter" },
      { emoji: "💧", name: "drop water" },
      { emoji: "🌍", name: "earth world" },
      { emoji: "🐾", name: "paws" },
      { emoji: "🦊", name: "fox" },
      { emoji: "🐼", name: "panda" },
      { emoji: "🐶", name: "dog" },
      { emoji: "🐱", name: "cat" },
    ],
  },
]

export function EmojiDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onInsert: (emoji: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("smileys")

  React.useEffect(() => {
    if (open) {
      setQuery("")
    }
  }, [open])

  const searching = query.trim().length > 0

  const results = React.useMemo(() => {
    if (!searching) return []
    const q = query.trim().toLowerCase()
    const seen = new Set<string>()
    const out: EmojiDef[] = []
    for (const cat of CATEGORIES) {
      for (const e of cat.emojis) {
        if (e.name.toLowerCase().includes(q) && !seen.has(e.emoji)) {
          seen.add(e.emoji)
          out.push(e)
        }
      }
    }
    return out
  }, [query, searching])

  const active = searching
    ? { id: "search", label: "Results", emojis: results }
    : CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smile className="h-4 w-4 text-primary" /> Emoji &amp; symbols
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search… (e.g. check, rocket, arrow)"
            className="h-9 pl-9"
            aria-label="Search emoji"
          />
        </div>

        {!searching && (
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Emoji categories">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={c.id === category}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  c.id === category
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div
          className="slim-scroll grid max-h-64 grid-cols-8 gap-1 overflow-y-auto p-1 sm:grid-cols-10"
          role="grid"
          aria-label={searching ? "Search results" : active.label}
        >
          {active.emojis.length === 0 ? (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              No emoji matches “{query}”.
            </p>
          ) : (
            active.emojis.map((e, i) => (
              <button
                key={`${e.emoji}-${i}`}
                onClick={() => onInsert(e.emoji)}
                title={e.name}
                aria-label={`Insert ${e.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-md text-xl leading-none transition-transform hover:scale-125 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                {e.emoji}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-foreground/70">
          <span>Click an emoji to insert it at the caret.</span>
          <Button variant="outline" size="sm" className="h-7 rounded-full px-4 text-xs font-medium shadow-sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
