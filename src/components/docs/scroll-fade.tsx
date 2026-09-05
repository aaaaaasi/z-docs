"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Right-edge fade affordance for a horizontally scrollable container.
 * Place inside the scroll container (which must be `relative`).
 * Auto-hides when the container is scrolled to its end.
 */
export function ScrollFade({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const update = () => setShow(el.scrollWidth - el.clientWidth - el.scrollLeft > 8)
    update()
    el.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent transition-opacity duration-150",
        show ? "opacity-100" : "opacity-0",
        className
      )}
    />
  )
}
