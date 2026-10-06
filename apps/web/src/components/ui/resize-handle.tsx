import * as React from "react"
import type { ResizableWidth } from "@/hooks/use-resizable-width"
import { cn } from "@/lib/utils"

/**
 * Drag handle on a panel's inner edge. `side` is where the panel sits on screen:
 * for a right-side panel the handle is on its left edge and dragging toward the page widens it.
 * Double-click resets; arrow keys resize (Shift for bigger steps).
 */
export function ResizeHandle({ side, size, className }: { side: "left" | "right"; size: ResizableWidth; className?: string }) {
  const start = React.useRef<{ x: number; width: number } | null>(null)
  const direction = side === "right" ? -1 : 1

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    start.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    size.setDragging(false)
    size.persist()
    document.body.style.removeProperty("cursor")
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={size.width}
      aria-valuemin={size.minWidth}
      aria-valuemax={size.maxWidth}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        start.current = { x: e.clientX, width: size.width }
        size.setDragging(true)
        document.body.style.cursor = "col-resize"
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        size.setWidth(start.current.width + direction * (e.clientX - start.current.x))
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => size.reset()}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 96 : 32
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault()
          const towardPage = (e.key === "ArrowLeft") === (side === "right")
          size.setWidth(size.width + (towardPage ? step : -step))
          size.persist()
        }
      }}
      className={cn(
        "group/resize absolute inset-y-0 z-10 w-3 cursor-col-resize touch-none outline-none",
        side === "right" ? "-left-1.5" : "-right-1.5",
        className
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-brand opacity-0 transition-opacity group-hover/resize:opacity-50 group-focus-visible/resize:opacity-70",
          size.dragging && "opacity-80 group-hover/resize:opacity-80"
        )}
      />
    </div>
  )
}
