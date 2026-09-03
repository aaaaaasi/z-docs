"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { CollabUser } from "@/lib/docs-types"
import { initialsOf } from "@/lib/doc-utils"

/** Overlapping presence avatars, Google-Docs style */
export function AvatarStack({
  users,
  max = 4,
  size = "md",
}: {
  users: CollabUser[]
  max?: number
  size?: "sm" | "md"
}) {
  const visible = users.slice(0, max)
  const rest = users.length - visible.length
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-[11px]"
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u) => (
        <Tooltip key={u.id}>
          <TooltipTrigger asChild>
            <div
              className={`${dim} flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background transition-transform hover:-translate-y-0.5`}
              style={{ backgroundColor: u.color }}
            >
              {initialsOf(u.name)}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span className="font-medium">{u.name}</span> is editing
          </TooltipContent>
        </Tooltip>
      ))}
      {rest > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-background`}
            >
              +{rest}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {users.slice(max).map((u) => u.name).join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
