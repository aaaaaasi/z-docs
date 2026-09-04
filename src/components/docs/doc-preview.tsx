"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

/**
 * Renders document HTML as a static, scaled-down thumbnail (like Google Docs cards).
 */
export function DocPreview({
  html,
  width,
  className,
  emptyLabel,
}: {
  html: string
  width: number
  className?: string
  emptyLabel?: string
}) {
  const { t } = useI18n()
  const label = emptyLabel ?? t("Blank document")
  const scale = width / 540
  return (
    <div
      className={cn("relative overflow-hidden bg-white", className)}
      style={{ width, height: Math.round(width * (7 / 5.4)) }}
      aria-hidden="true"
    >
      <div className="doc-preview" style={{ transform: `scale(${scale})` }}>
        {html ? (
          <div className="doc-content" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className="doc-content text-[#a3a09a]">{label}</div>
        )}
      </div>
      {/* subtle edge fade so previews end softly */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/90 to-transparent" />
    </div>
  )
}
