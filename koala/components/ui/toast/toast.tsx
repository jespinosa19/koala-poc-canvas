"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"
import { CheckCircle, Warning, XCircle, Info, X } from "koala-icons"

import { tv } from "@/lib/tv"
import { cn } from "@/lib/utils"
import { hitBoxPositioned } from "@/lib/hit-area"
import { AnimatedLabel } from "@/components/ui/animated-label"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { type ToastAppearance, type ToastData, startDismiss } from "./use-toast"

export const toastVariants = tv({
  slots: {
    root: ["group/toast absolute bottom-0 left-0 right-0"],
    surface: [
      "relative flex w-full items-start gap-3 overflow-hidden rounded-xl bg-popover p-4 [--surface:var(--popover)]",
      "shadow-lg ring-1 ring-inset ring-border",
      "transition-[opacity,translate,scale] duration-slow ease-out",
      "group-data-[swipe=move]/toast:translate-x-(--radix-toast-swipe-move-x) group-data-[swipe=move]/toast:transition-none",
      "group-data-[swipe=cancel]/toast:translate-x-0",
      "group-data-[swipe=end]/toast:translate-x-(--radix-toast-swipe-end-x)",
      "[--shake-distance:3px] motion-reduce:animate-none",
    ],
    iconWrap: "relative mt-px size-[18px] shrink-0 [&_svg]:size-[18px]",
    iconLayer: "absolute inset-0 grid place-items-center transition-[opacity,scale,filter] duration-fast ease-out",
    content: "flex min-w-0 flex-1 flex-col gap-0.5 pr-5",
    title: "text-sm font-semibold leading-snug",
    description: "text-sm text-pretty leading-snug text-muted-foreground",
    close: [
      "absolute top-3 right-3",
      "grid size-6 shrink-0 cursor-pointer place-items-center rounded-md",
      hitBoxPositioned,
      "text-muted-foreground/60",
      "transition-[color,background-color,scale] duration-fast ease-out",
      "hover:bg-accent hover:text-foreground",
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
      "[&_svg]:size-3.5 [&_svg]:pointer-events-none",
    ],
    action: "mt-2 self-start",
    bar: "",
    countdown: [
      "pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left opacity-40",
      "animate-toast-countdown",
    ],
    track: "mt-2.5 h-1 w-full overflow-hidden rounded-full bg-foreground/10",
    fill: "h-full w-full rounded-full transition-[translate] duration-base ease-out",
    anchored: [
      "pointer-events-none fixed z-[100] flex items-center gap-1.5 whitespace-nowrap",
      "rounded-lg bg-popover px-2.5 py-1.5 text-sm font-medium text-popover-foreground [--surface:var(--popover)]",
      "shadow-lg ring-1 ring-inset ring-border",
      "data-[side=top]:origin-bottom data-[side=bottom]:origin-top",
      "transition-[opacity,scale,translate] duration-fast ease-out",
      "[--shake-distance:2px] motion-reduce:animate-none",
    ],
  },
  variants: {
    variant: {
      default: {
        iconWrap: "text-muted-foreground",
        action: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        bar: "bg-foreground",
      },
      success: {
        iconWrap: "text-success",
        action: "bg-success/10 text-success hover:bg-success/20",
        bar: "bg-success",
      },
      warning: {
        iconWrap: "text-warning",
        action: "bg-warning/10 text-warning hover:bg-warning/20",
        bar: "bg-warning",
      },
      destructive: {
        iconWrap: "text-destructive",
        action: "bg-destructive/10 text-destructive-strong hover:bg-destructive/20",
        bar: "bg-destructive",
      },
      info: {
        iconWrap: "text-info",
        action: "bg-info/10 text-info hover:bg-info/20",
        bar: "bg-info",
      },
      loading: {
        iconWrap: "text-muted-foreground",
        action: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        bar: "bg-foreground",
      },
    },
    appearance: {
      card: {},
      minimal: {
        surface: "items-center gap-2.5 rounded-lg px-3.5 py-2.5",
        iconWrap: "mt-0 size-4 [&_svg]:size-4",
        content: "gap-0 pr-0",
        title: "font-medium",
        close: [
          "relative top-auto right-auto -mr-1",
          "opacity-0 transition-[color,background-color,opacity,scale] group-hover/toast:opacity-100 group-focus-within/toast:opacity-100",
          "pointer-coarse:opacity-100",
        ],
        action: "mt-0 shrink-0 self-center",
        track: "mt-2",
      },
    },
  },
  defaultVariants: {
    variant: "default",
    appearance: "card",
  },
})

const VARIANT_ICONS = {
  success: CheckCircle,
  warning: Warning,
  destructive: XCircle,
  info: Info,
} satisfies Partial<Record<NonNullable<ToastData["variant"]>, React.ElementType>>

const LAYER_SHOWN = "opacity-100 scale-100 blur-[0px]"
const LAYER_HIDDEN = "opacity-0 scale-[0.25] blur-[4px]"

const REPLAY = {
  pop: ["animate-toast-pop-a", "animate-toast-pop-b"],
  shake: ["animate-shake-a", "animate-shake-b"],
} as const

function replayClass({ replay, variant, progress }: ToastData): string | undefined {
  if (replay === 0 || variant === "loading" || progress !== undefined) return undefined
  const kind = variant === "destructive" || variant === "warning" ? "shake" : "pop"
  return REPLAY[kind][replay % 2]
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
}

export interface ToastItemProps {
  toast: ToastData
  appearance: ToastAppearance
  countdown: boolean
  paused?: boolean
  stackStyle: React.CSSProperties
  onHeightChange: (id: string, height: number | null) => void
  onExpand: () => void
  onCollapse: () => void
  ref?: React.Ref<HTMLLIElement>
}

export function ToastItem({
  toast,
  appearance,
  countdown,
  stackStyle,
  paused = false,
  onHeightChange,
  onExpand,
  onCollapse,
  ref,
}: ToastItemProps) {
  const [entered, setEntered] = React.useState(false)
  const surfaceRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    onHeightChange(toast.id, el.offsetHeight)
    const ro = new ResizeObserver(() => onHeightChange(toast.id, el.offsetHeight))
    ro.observe(el)
    return () => {
      ro.disconnect()
      onHeightChange(toast.id, null)
    }
  }, [toast.id, onHeightChange])

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const slots = toastVariants({ variant: toast.variant, appearance })
  const isLoading = toast.variant === "loading"
  const isMinimal = appearance === "minimal"
  const Icon =
    toast.variant && toast.variant !== "default" && toast.variant !== "loading"
      ? VARIANT_ICONS[toast.variant]
      : null
  const closeAfter = Number.isFinite(toast.duration) ? toast.duration + (toast.replay % 2) : toast.duration
  const labelKey = `${toast.variant ?? "default"}:${typeof toast.title === "string" ? toast.title : toast.replay}`
  const showCountdown = countdown && toast.open && Number.isFinite(closeAfter)

  const action = toast.action && (
    <ToastPrimitive.Action altText={toast.action.label} asChild>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={toast.action.onClick}
        data-slot="toast-action"
        className={slots.action()}
      >
        {toast.action.label}
      </Button>
    </ToastPrimitive.Action>
  )

  const [focused, setFocused] = React.useState(false)
  const remaining = React.useRef({ key: "", ms: closeAfter })
  const timerKey = `${toast.duration}:${toast.replay}`
  const running = toast.open && !paused && !focused && Number.isFinite(toast.duration)
  React.useEffect(() => {
    if (remaining.current.key !== timerKey) remaining.current = { key: timerKey, ms: closeAfter }
    if (!running) return
    const startedAt = Date.now()
    const id = setTimeout(() => startDismiss(toast.id), remaining.current.ms)
    return () => {
      clearTimeout(id)
      remaining.current.ms -= Date.now() - startedAt
    }
  }, [running, toast.id, closeAfter, timerKey])

  return (
    <ToastPrimitive.Root
      ref={ref}
      data-slot="toast"
      open={toast.open}
      forceMount
      type={toast.variant === "destructive" ? "foreground" : "background"}
      onOpenChange={open => {
        if (!open) startDismiss(toast.id)
      }}
      duration={Infinity}
      onMouseEnter={onExpand}
      onMouseLeave={onCollapse}
      onFocus={() => setFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
      className={cn(
        slots.root(),
        !toast.open && "opacity-0",
      )}
      style={stackStyle}
    >
      <div
        ref={surfaceRef}
        data-slot="toast-surface"
        className={cn(
          slots.surface(),
          !entered && "translate-y-4 scale-[0.96] opacity-0",
          !toast.open && "translate-y-4 scale-[0.96] opacity-0 ease-in-out",
          replayClass(toast),
        )}
      >
        {(Icon || toast.wasLoading) && (
          <div data-slot="toast-icon" className={slots.iconWrap()}>
            {toast.wasLoading && (
              <span className={cn(slots.iconLayer(), isLoading ? LAYER_SHOWN : LAYER_HIDDEN)}>
                <Spinner aria-hidden />
              </span>
            )}
            {Icon && (
              <span className={cn(slots.iconLayer(), isLoading ? LAYER_HIDDEN : LAYER_SHOWN)}>
                <Icon weight="fill" />
              </span>
            )}
          </div>
        )}
        <div data-slot="toast-content" className={slots.content()}>
          {toast.title && (
            <ToastPrimitive.Title data-slot="toast-title" className={slots.title()}>
              {toast.wasLoading ? (
                <AnimatedLabel swapKey={labelKey} align="start">
                  {toast.title}
                </AnimatedLabel>
              ) : (
                toast.title
              )}
            </ToastPrimitive.Title>
          )}
          {toast.description && (
            <ToastPrimitive.Description data-slot="toast-description" className={slots.description()}>
              {toast.description}
            </ToastPrimitive.Description>
          )}
          {toast.progress !== undefined && (
            <div
              data-slot="toast-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(clampProgress(toast.progress))}
              className={slots.track()}
            >
              <div
                className={cn(slots.fill(), slots.bar())}
                style={{ translate: `${clampProgress(toast.progress) - 100}% 0` }}
              />
            </div>
          )}
          {!isMinimal && action}
        </div>
        {isMinimal && action}
        <ToastPrimitive.Close data-slot="toast-close" className={slots.close()}>
          <X weight="bold" />
        </ToastPrimitive.Close>
        {showCountdown && (
          <div
            key={toast.replay}
            aria-hidden
            data-slot="toast-countdown"
            className={cn(slots.countdown(), slots.bar())}
            style={
              {
                "--toast-duration": `${closeAfter}ms`,
                animationPlayState: running ? "running" : "paused",
              } as React.CSSProperties
            }
          />
        )}
      </div>
    </ToastPrimitive.Root>
  )
}

const ANCHOR_GAP = 8
const VIEWPORT_MARGIN = 8
const FLIP_THRESHOLD = 48

export interface AnchoredToastProps {
  toast: ToastData
}

export function AnchoredToast({ toast }: AnchoredToastProps) {
  const [entered, setEntered] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const rect = toast.anchorRect

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || !rect) return
    const side = rect.top < FLIP_THRESHOLD ? "bottom" : "top"
    const width = el.offsetWidth
    const center = rect.left + rect.width / 2
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, center - width / 2),
      window.innerWidth - VIEWPORT_MARGIN - width,
    )
    const top = side === "top" ? rect.top - ANCHOR_GAP - el.offsetHeight : rect.bottom + ANCHOR_GAP
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.dataset.side = side
  }, [rect, toast.title])

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const slots = toastVariants({ variant: toast.variant })
  const isLoading = toast.variant === "loading"
  const Icon =
    toast.variant && toast.variant !== "default" && toast.variant !== "loading"
      ? VARIANT_ICONS[toast.variant]
      : null

  return (
    <div
      ref={ref}
      aria-hidden
      data-slot="toast-anchored"
      className={cn(
        slots.anchored(),
        !entered && "scale-[0.96] opacity-0 data-[side=top]:translate-y-1 data-[side=bottom]:-translate-y-1",
        !toast.open && "scale-[0.96] opacity-0",
        replayClass(toast),
      )}
    >
      {(Icon || toast.wasLoading) && (
        <span className={cn(slots.iconWrap(), "mt-0 size-4 [&_svg]:size-4")}>
          {toast.wasLoading && (
            <span className={cn(slots.iconLayer(), isLoading ? LAYER_SHOWN : LAYER_HIDDEN)}>
              <Spinner />
            </span>
          )}
          {Icon && (
            <span className={cn(slots.iconLayer(), isLoading ? LAYER_HIDDEN : LAYER_SHOWN)}>
              <Icon weight="fill" />
            </span>
          )}
        </span>
      )}
      {toast.title}
    </div>
  )
}
