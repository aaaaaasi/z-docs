"use client"

/**
 * Z-Slides — app root. Internal modes: list (Drive-like deck browser),
 * editor (deck editor) and present (fullscreen presenter). Consumes the
 * workspace deep-link target on mount (`/?app=slides&entity=<id>`) and
 * opens that deck directly in the editor.
 */

import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { useDocsStore } from "@/store/docs-store"
import { useI18n } from "@/lib/i18n"
import { useSlidesStore } from "./deck-store"
import { SlidesList } from "./slides-list"
import { DeckEditor } from "./deck-editor"
import { PresentMode } from "./present-mode"

type SlidesMode = "list" | "editor" | "present"

function BootSkeleton() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true" aria-label={t("Loading Z-Slides")}>
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-5 w-24" />
        <div className="ml-auto">
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </div>
      <div className="flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg p-2">
              <Skeleton className="aspect-video w-full rounded-md" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-1.5 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SlidesApp() {
  const consumeAppTarget = useDocsStore((s) => s.consumeAppTarget)
  const openDeck = useSlidesStore((s) => s.openDeck)
  const closeDeck = useSlidesStore((s) => s.closeDeck)
  const fetchList = useSlidesStore((s) => s.fetchList)
  const createAndOpenDeck = useSlidesStore((s) => s.createAndOpenDeck)
  const editorData = useSlidesStore((s) => s.data)

  const { toast } = useToast()
  const { t } = useI18n()

  const [mode, setMode] = React.useState<SlidesMode>("list")
  const [booting, setBooting] = React.useState(true)
  const [presentStart, setPresentStart] = React.useState(0)
  const consumed = React.useRef(false)

  // one-shot deep-link target consumption on mount
  React.useEffect(() => {
    if (consumed.current) return
    consumed.current = true
    const target = consumeAppTarget()
    const boot = async () => {
      if (target && target.app === "slides" && target.id) {
        const ok = await openDeck(target.id)
        if (ok) {
          setMode("editor")
        } else {
          toast({
            title: t("Couldn’t open that presentation"),
            description: t("It may have been deleted."),
            variant: "destructive",
          })
          await fetchList()
          setMode("list")
        }
      } else {
        await fetchList()
        setMode("list")
      }
      setBooting(false)
    }
    void boot()
  }, [consumeAppTarget, openDeck, fetchList, toast, t])

  /* ---------- mode transitions ---------- */

  const openDeckFromList = async (id: string) => {
    const ok = await openDeck(id)
    if (ok) {
      setMode("editor")
    } else {
      toast({
        title: t("Couldn’t open that presentation"),
        description: t("It may have been deleted."),
        variant: "destructive",
      })
      await fetchList({ silent: true })
    }
  }

  const newDeck = async () => {
    const meta = await createAndOpenDeck()
    if (meta) {
      setMode("editor")
    } else {
      toast({ title: t("Couldn’t create the presentation"), variant: "destructive" })
    }
  }

  const backToList = async () => {
    await closeDeck() // flushes pending autosave
    await fetchList()
    setMode("list")
  }

  const startPresent = (startIndex: number) => {
    setPresentStart(startIndex)
    setMode("present")
  }
  const exitPresent = () => setMode("editor")

  if (booting) return <BootSkeleton />

  return (
    <TooltipProvider delayDuration={250}>
      {mode === "list" ? (
        <SlidesList onOpenDeck={openDeckFromList} onNewDeck={newDeck} />
      ) : mode === "editor" ? (
        <DeckEditor onBack={backToList} onPresent={startPresent} />
      ) : editorData && editorData.slides.length > 0 ? (
        <PresentMode deck={editorData} startIndex={presentStart} onExit={exitPresent} />
      ) : (
        <DeckEditor onBack={backToList} onPresent={startPresent} />
      )}
    </TooltipProvider>
  )
}
