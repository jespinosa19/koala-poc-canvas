"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { duration, easing } from "@/lib/motion"
import { type ToastAppearance, dismissAnchoredToasts, useToastStore } from "./use-toast"
import { AnchoredToast, ToastItem } from "./toast"

const MAX_COLLAPSED_VISIBLE = 3
const COLLAPSED_OFFSET = 16
const COLLAPSED_SCALE = 0.04
const EXPANDED_GAP = 16
const FALLBACK_H = 56

const EXPAND_TRANSITION   = `transform ${duration.base}ms ${easing.out}, opacity ${duration.fast}ms ${easing.out}`
const COLLAPSE_TRANSITION = `transform ${duration.base}ms ${easing.inOut}, opacity ${duration.fast}ms ${easing.out}`
const SNAP_TRANSITION     = `opacity ${duration.fast}ms ${easing.out}, transform ${duration.fast}ms ${easing.out}`
const VIEWPORT_COLLAPSE   = `height ${duration.base}ms ${easing.inOut}`
const COLLAPSE_DELAY = 100

const ANCHOR_LISTENER = { capture: true, passive: true } as const

type ViewportProps = React.ComponentProps<typeof ToastPrimitive.Viewport>
type ProviderProps = React.ComponentProps<typeof ToastPrimitive.Provider>

function usePageHidden(): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      document.addEventListener("visibilitychange", cb)
      return () => document.removeEventListener("visibilitychange", cb)
    },
    () => document.visibilityState === "hidden",
    () => false,
  )
}

export interface ToasterProps
  extends Omit<ViewportProps, "children" | "asChild">,
    Pick<ProviderProps, "swipeDirection" | "swipeThreshold"> {
  className?: string
  appearance?: ToastAppearance
  countdown?: boolean
}

export function Toaster({
  className,
  style,
  appearance = "card",
  countdown = false,
  swipeDirection = "right",
  swipeThreshold,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onFocus,
  onBlur,
  ...viewportProps
}: ToasterProps = {}) {
  const toasts = useToastStore()
  const stacked = React.useMemo(() => toasts.filter((t) => !t.anchorRect), [toasts])
  const live = React.useMemo(() => stacked.filter((t) => t.open), [stacked])
  const anchored = React.useMemo(() => toasts.filter((t) => t.anchorRect), [toasts])
  const hasOpenAnchored = anchored.some((t) => t.open)
  const [expanded, setExpanded] = React.useState(false)
  const [heights, setHeights] = React.useState<Record<string, number>>({})
  const collapseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageHidden = usePageHidden()

  const handleExpand = React.useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
    setExpanded(true)
  }, [])

  const handleCollapse = React.useCallback(() => {
    collapseTimer.current = setTimeout(() => setExpanded(false), COLLAPSE_DELAY)
  }, [])

  React.useEffect(() => () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current)
  }, [])

  React.useEffect(() => {
    const collapse = () => setExpanded(false)
    window.addEventListener("blur", collapse)
    return () => window.removeEventListener("blur", collapse)
  }, [])

  React.useEffect(() => {
    if (!hasOpenAnchored) return
    window.addEventListener("scroll", dismissAnchoredToasts, ANCHOR_LISTENER)
    window.addEventListener("resize", dismissAnchoredToasts, ANCHOR_LISTENER)
    return () => {
      window.removeEventListener("scroll", dismissAnchoredToasts, ANCHOR_LISTENER)
      window.removeEventListener("resize", dismissAnchoredToasts, ANCHOR_LISTENER)
    }
  }, [hasOpenAnchored])

  const handleHeightChange = React.useCallback((id: string, h: number | null) => {
    setHeights(prev => {
      if (h === null) {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      if (prev[id] === h) return prev
      return { ...prev, [id]: h }
    })
  }, [])

  function getStackStyle(index: number): React.CSSProperties {
    if (!expanded && index >= MAX_COLLAPSED_VISIBLE) {
      const backY     = (MAX_COLLAPSED_VISIBLE - 1) * COLLAPSED_OFFSET
      const backScale = 1 - (MAX_COLLAPSED_VISIBLE - 1) * COLLAPSED_SCALE
      return {
        transform: `translateY(-${backY}px) scale(${backScale})`,
        opacity: 0,
        pointerEvents: "none",
        zIndex: 30 - index,
        transition: SNAP_TRANSITION,
      }
    }

    if (!expanded) {
      return {
        transform: `translateY(-${index * COLLAPSED_OFFSET}px) scale(${1 - index * COLLAPSED_SCALE})`,
        opacity: index === 0 ? 1 : 1 - index * 0.15,
        zIndex: 30 - index,
        transition: COLLAPSE_TRANSITION,
      }
    }

    let y = 0
    for (let i = 0; i < index; i++) {
      y += (heights[live[i]?.id] ?? FALLBACK_H) + EXPANDED_GAP
    }
    return {
      transform: `translateY(-${y}px) scale(1)`,
      zIndex: 30 - index,
      transition: EXPAND_TRANSITION,
    }
  }

  const viewportHeight = React.useMemo(() => {
    if (live.length === 0) return 0
    if (!expanded) {
      const frontH  = heights[live[0]?.id] ?? FALLBACK_H
      const peeking = Math.min(live.length - 1, MAX_COLLAPSED_VISIBLE - 1)
      return frontH + peeking * COLLAPSED_OFFSET
    }
    return live.reduce(
      (sum, t, i) => sum + (heights[t.id] ?? FALLBACK_H) + (i > 0 ? EXPANDED_GAP : 0),
      0,
    )
  }, [live, heights, expanded])

  const announced = anchored.find((t) => t.open)?.title

  return (
    <>
      {stacked.length > 0 && (
        <ToastPrimitive.Provider swipeDirection={swipeDirection} swipeThreshold={swipeThreshold}>
          {stacked.map((t) => (
            <ToastItem
              key={`${t.id}:${t.epoch}`}
              toast={t}
              appearance={t.appearance ?? appearance}
              countdown={t.countdown ?? countdown}
              stackStyle={t.open ? getStackStyle(live.indexOf(t)) : { ...getStackStyle(0), zIndex: 0 }}
              paused={expanded || pageHidden}
              onHeightChange={handleHeightChange}
              onExpand={handleExpand}
              onCollapse={handleCollapse}
            />
          ))}

          <ToastPrimitive.Viewport
            data-slot="toast-viewport"
            {...viewportProps}
            onMouseEnter={(event) => {
              onMouseEnter?.(event)
              handleExpand()
            }}
            onMouseMove={(event) => {
              onMouseMove?.(event)
              handleExpand()
            }}
            onMouseLeave={(event) => {
              onMouseLeave?.(event)
              handleCollapse()
            }}
            onFocus={(event) => {
              onFocus?.(event)
              handleExpand()
            }}
            onBlur={(event) => {
              onBlur?.(event)
              setExpanded(false)
            }}
            style={{
              ...style,
              height: viewportHeight > 0 ? viewportHeight : undefined,
              transition: expanded ? undefined : VIEWPORT_COLLAPSE,
            }}
            className={cn(
              "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[100]",
              "w-[380px] max-w-[calc(100vw-2rem)]",
              "m-0 list-none p-0 outline-none",
              className,
            )}
          />
        </ToastPrimitive.Provider>
      )}

      {anchored.map((t) => (
        <AnchoredToast key={t.id} toast={t} />
      ))}

      <div data-slot="toast-announcer" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announced}
      </div>
    </>
  )
}
