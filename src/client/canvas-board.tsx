"use client"

import * as React from "react"
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  ChatCircle,
  ChatsCircle,
  CornersIn,
  CornersOut,
  Cursor,
  FrameCorners,
  Minus,
  PencilSimple,
  Plus,
  Question,
  Star,
  X,
} from "koala-icons"

import { cn } from "@/lib/utils"
import type {
  CanvasComment,
  CanvasDrawing,
  CanvasInkColor,
  CanvasRequest,
  CanvasRequestKind,
  CanvasState,
  CanvasVerdict,
} from "../store"
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarTitle,
  ToolbarToggleGroup,
  ToolbarToggleItem,
  EmptyNote,
} from "./canvas-toolbar"
import { toast } from "@/components/ui/toast"

import {
  boundsOf,
  breakpointOf,
  clampFrameSize,
  fitCamera,
  layoutFrames,
  ROW_GAP,
  snapWidth,
  type Camera,
  type Inset,
  type PlacedFrame,
} from "./camera"
import { describeTarget, sendOp } from "./canvas-api"
import { CommentPin, CommentsPanel, DraftPin, type CommentDraft } from "./canvas-comments"
import {
  INK_MODE_KEYS,
  INK_SCREEN_SIZE,
  InkLayer,
  InkToolbar,
  inkHit,
  inkOffset,
  type InkMode,
  type InkStroke,
} from "./canvas-ink"
import { RequestButton, VERDICT_LABEL } from "./canvas-requests"
import { useCamera } from "./use-camera"

type Tool = "move" | "comment" | "draw"
type Undo = { kind: "added"; ids: string[] } | { kind: "removed"; drawings: CanvasDrawing[] }
type Scroll = { x: number; y: number }
type Area = { x: number; y: number; width?: number; height?: number }
type Edge = "x" | "y" | "xy"
type Resize = { id: string; width: number; height: number }

const ZOOM_STEP = 1.25
const DIM_GAP = 14
const LABEL_GAP = 30
const ROW_LABEL_GAP = 56
const DRAG_THRESHOLD = 4

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  return Boolean(el?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']"))
}

/** Keys the canvas takes back from a frame's page when you are not typing in it. */
const FRAME_KEYS = new Set(["escape", "c", "v", "d", "p", "m", "x"])

/** Give the keyboard back to the canvas when an iframe holds it. */
const reclaimFocus = () => {
  const active = document.activeElement
  if (active instanceof HTMLIFrameElement) active.blur()
  if (document.activeElement instanceof HTMLIFrameElement) window.focus()
}

const loadPref = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const value = localStorage.getItem(`koala-canvas:${key}`)
    return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

const savePref = (key: string, value: string) => {
  try {
    localStorage.setItem(`koala-canvas:${key}`, value)
  } catch {}
}

const INK_MODES: readonly InkMode[] = ["pen", "marker", "arrow", "rect", "ellipse", "eraser"]
const INK_COLORS_LIST: readonly CanvasInkColor[] = ["lime", "red", "amber", "blue", "white"]

const VERDICT_ICON: Record<CanvasVerdict, typeof Star> = { pick: Star, maybe: Question, out: X }
const VERDICT_KEY: Record<string, CanvasVerdict> = { p: "pick", m: "maybe", x: "out" }

function VerdictMark({ verdict }: { verdict: CanvasVerdict }) {
  const Icon = VERDICT_ICON[verdict]
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full",
        verdict === "pick" && "bg-brand text-brand-foreground",
        verdict === "maybe" && "text-foreground ring-1 ring-foreground/50 ring-inset",
        verdict === "out" && "text-muted-foreground",
      )}
    >
      <Icon weight={verdict === "pick" ? "fill" : "bold"} className="size-2.5" aria-hidden />
      <span className="sr-only">{VERDICT_LABEL[verdict]}</span>
    </span>
  )
}

function VerdictGroup({ value, onChange }: { value: CanvasVerdict | null; onChange: (verdict: CanvasVerdict | null) => void }) {
  return (
    <ToolbarToggleGroup
      type="single"
      value={value ?? ""}
      onValueChange={(next) => onChange((next || null) as CanvasVerdict | null)}
      aria-label="Verdict"
    >
      {(["pick", "maybe", "out"] as const).map((verdict) => {
        const Icon = VERDICT_ICON[verdict]
        return (
          <ToolbarToggleItem
            key={verdict}
            value={verdict}
            tooltip={VERDICT_LABEL[verdict]}
            shortcut={verdict === "pick" ? "P" : verdict === "maybe" ? "M" : "X"}
            aria-label={VERDICT_LABEL[verdict]}
          >
            <Icon weight={verdict === "pick" && value === "pick" ? "fill" : "bold"} />
          </ToolbarToggleItem>
        )
      })}
    </ToolbarToggleGroup>
  )
}

const FrameView = React.memo(function FrameView({
  frame,
  interactive,
  dimmed,
  out,
  lifted,
  reloadKey,
  shield,
  onFrameLoad,
}: {
  frame: PlacedFrame
  interactive: boolean
  dimmed: boolean
  out: boolean
  lifted: boolean
  reloadKey: number
  shield: React.ReactNode
  onFrameLoad: (id: string, element: HTMLIFrameElement) => void
}) {
  return (
    <div
      data-frame={frame.id}
      style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
      className={cn(
        "absolute overflow-clip rounded-[3px] bg-background ring-1 ring-(--canvas-stroke) transition-[opacity,box-shadow] duration-base ease-out",
        lifted ? "shadow-2xl" : "shadow-[0_1px_2px_0_oklch(0_0_0/0.25),0_8px_24px_-6px_oklch(0_0_0/0.45)]",
        dimmed ? "opacity-30" : out && "opacity-45",
      )}
    >
      {frame.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={frame.src} alt={frame.title} draggable={false} className="block size-full object-cover object-top" />
      ) : (
        <iframe
          key={reloadKey}
          src={frame.src}
          title={frame.title}
          onLoad={(event) => onFrameLoad(frame.id, event.currentTarget)}
          className={cn("block size-full border-0 bg-background", !interactive && "pointer-events-none")}
        />
      )}
      {!interactive && shield}
    </div>
  )
})

function Dimension({
  left,
  top,
  length,
  value,
  vertical = false,
  hidden = false,
}: {
  left: number
  top: number
  length: number
  value: number
  vertical?: boolean
  hidden?: boolean
}) {
  return (
    <div
      aria-hidden
      style={vertical ? { left, top, height: length } : { left, top, width: length }}
      className={cn(
        "absolute flex items-center justify-center text-muted-foreground transition-opacity duration-base ease-out",
        vertical ? "w-0 flex-col" : "h-0",
        hidden && "opacity-0",
      )}
    >
      <span className={cn("absolute bg-foreground/15", vertical ? "inset-y-0 left-0 w-px" : "inset-x-0 top-0 h-px")} />
      <span className={cn("absolute bg-foreground/30", vertical ? "top-0 -left-1 h-px w-2" : "-top-1 left-0 h-2 w-px")} />
      <span className={cn("absolute bg-foreground/30", vertical ? "bottom-0 -left-1 h-px w-2" : "-top-1 right-0 h-2 w-px")} />
      <span
        className={cn(
          "relative bg-(--canvas-ground) px-1.5 font-mono text-[0.625rem] leading-none tabular-nums",
          vertical && "-rotate-90",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function CanvasBoard({
  initial,
  apiBase = "/api/canvas",
  command = "koala-poc-canvas",
}: {
  initial: CanvasState
  apiBase?: string
  command?: string
}) {
  const name = initial.name
  const [state, setState] = React.useState(initial)
  const [tool, setTool] = React.useState<Tool>("move")
  const [selected, setSelected] = React.useState<string | null>(null)
  const [focused, setFocused] = React.useState<string | null>(null)
  const [hovered, setHovered] = React.useState<string | null>(null)
  const [activeComment, setActiveComment] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<CommentDraft | null>(null)
  const [dragArea, setDragArea] = React.useState<(Area & { frameId: string }) | null>(null)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [showResolved, setShowResolved] = React.useState(false)
  const [scrolls, setScrolls] = React.useState<Record<string, Scroll>>({})
  const [reloadKeys, setReloadKeys] = React.useState<Record<string, number>>({})
  const [view, setView] = React.useState({ width: 0, height: 0 })
  const [panning, setPanning] = React.useState(false)
  const [space, setSpace] = React.useState(false)
  const [connected, setConnected] = React.useState(true)
  const [resize, setResize] = React.useState<Resize | null>(null)
  const [group, setGroup] = React.useState<string[]>([])
  const [asking, setAsking] = React.useState<CanvasRequestKind | null>(null)
  const [inkMode, setInkModeState] = React.useState<InkMode>(() => loadPref("ink-mode", INK_MODES, "pen"))
  const [inkColor, setInkColorState] = React.useState<CanvasInkColor>(() => loadPref("ink-color", INK_COLORS_LIST, "lime"))
  const [inkDraft, setInkDraft] = React.useState<InkStroke | null>(null)
  const [undoStack, setUndoStack] = React.useState<Undo[]>([])
  const [erasing, setErasing] = React.useState<string[]>([])

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const frameEls = React.useRef(new Map<string, HTMLIFrameElement>())
  const frameCleanups = React.useRef(new Map<string, () => void>())
  const beforeFocus = React.useRef<Camera | null>(null)
  const placedOnce = React.useRef(false)
  const escapeRef = React.useRef<() => void>(() => {})
  const keyRef = React.useRef<(event: KeyboardEvent, fromFrame: boolean) => void>(() => {})
  const interactiveRef = React.useRef<string | null>(null)

  const { camera, cameraRef, zoomBy, panBy, flyTo, zoomTargetValue, grid } = useCamera(viewportRef, { x: 0, y: 0, z: 0.25 })

  const frames = React.useMemo(
    () =>
      resize
        ? state.frames.map((frame) =>
            frame.id === resize.id ? { ...frame, width: resize.width, height: resize.height } : frame,
          )
        : state.frames,
    [resize, state.frames],
  )
  const layout = React.useMemo(() => layoutFrames(frames), [frames])
  const frameById = React.useMemo(() => new Map(layout.frames.map((frame) => [frame.id, frame])), [layout.frames])
  const numberOf = React.useCallback(
    (id: string) => state.comments.findIndex((comment) => comment.id === id) + 1,
    [state.comments],
  )

  const inset = React.useCallback(
    (focusMode = false): Inset => ({
      top: focusMode ? 64 : 152,
      bottom: 88,
      left: focusMode ? 32 : 48,
      right: (panelOpen ? 344 : 0) + (focusMode ? 32 : 48),
    }),
    [panelOpen],
  )

  const fitAll = React.useCallback(
    (instant = false) => {
      const box = boundsOf(layout.frames)
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!box || !rect) return
      flyTo(fitCamera(box, rect, inset()), instant)
    },
    [flyTo, inset, layout.frames],
  )

  const fitFrame = React.useCallback(
    (id: string, focusMode = false) => {
      const frame = frameById.get(id)
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!frame || !rect) return
      flyTo(fitCamera({ x: frame.left, y: frame.top, width: frame.width, height: frame.height }, rect, inset(focusMode), 1))
    },
    [flyTo, frameById, inset],
  )

  const focusFrame = React.useCallback(
    (id: string) => {
      if (!focused) beforeFocus.current = cameraRef.current
      setSelected(id)
      setFocused(id)
      setDraft(null)
      setActiveComment(null)
      fitFrame(id, true)
    },
    [cameraRef, fitFrame, focused],
  )

  const exitFocus = React.useCallback(() => {
    setFocused(null)
    if (beforeFocus.current) flyTo(beforeFocus.current)
    beforeFocus.current = null
  }, [flyTo])

  const step = React.useCallback(
    (direction: 1 | -1) => {
      const ids = layout.frames.map((frame) => frame.id)
      if (!ids.length) return
      const from = focused ?? selected
      const index = from ? ids.indexOf(from) : -1
      const next = ids[(index + direction + ids.length) % ids.length]
      if (focused) focusFrame(next)
      else {
        setSelected(next)
        fitFrame(next)
      }
    },
    [fitFrame, focusFrame, focused, layout.frames, selected],
  )

  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setView({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    // The camera is the only thing that moves the canvas. `overflow: clip` already forbids scrolling;
    // this catches browsers that still scroll the box to reveal a focused frame, which slid every
    // overlay (pins, the comment layer) away from the frames it belongs to.
    const unscroll = () => {
      if (el.scrollLeft || el.scrollTop) el.scrollTo(0, 0)
    }
    el.addEventListener("scroll", unscroll)
    return () => {
      observer.disconnect()
      el.removeEventListener("scroll", unscroll)
    }
  }, [])

  React.useEffect(() => {
    if (placedOnce.current || !view.width) return
    placedOnce.current = true
    try {
      const saved = localStorage.getItem(`koala-canvas:${name}:camera`)
      if (saved) {
        const camera = JSON.parse(saved) as Camera
        if ([camera.x, camera.y, camera.z].every(Number.isFinite)) {
          flyTo(camera, true)
          return
        }
      }
    } catch {}
    fitAll(true)
  }, [fitAll, flyTo, name, view.width])

  React.useEffect(() => {
    if (!placedOnce.current) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`koala-canvas:${name}:camera`, JSON.stringify(camera))
      } catch {}
    }, 400)
    return () => clearTimeout(timer)
  }, [apiBase, camera, name])

  const lastContext = React.useRef({ selection: "", viewport: "" })

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const viewport = { x: Math.round(camera.x), y: Math.round(camera.y), zoom: Math.round(camera.z * 1000) / 1000 }
      const key = JSON.stringify(viewport)
      if (document.hidden || key === lastContext.current.viewport) return
      lastContext.current.viewport = key
      sendOp(apiBase, name, { op: "context", viewport }).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  }, [apiBase, camera, name])

  React.useEffect(() => {
    const send = () => {
      let theme: string | null = null
      try {
        theme = localStorage.getItem("theme")
      } catch {}
      if (!theme || theme === "system") theme = scheme.matches ? "dark" : "light"
      sendOp(apiBase, name, { op: "context", theme }).catch(() => {})
    }
    const scheme = window.matchMedia("(prefers-color-scheme: dark)")
    send()
    window.addEventListener("storage", send)
    scheme.addEventListener("change", send)
    return () => {
      window.removeEventListener("storage", send)
      scheme.removeEventListener("change", send)
    }
  }, [apiBase, name])

  React.useEffect(() => {
    const key = JSON.stringify([selected, focused])
    if (key === lastContext.current.selection) return
    lastContext.current.selection = key
    sendOp(apiBase, name, { op: "context", selected, focused }).catch(() => {})
  }, [apiBase, focused, name, selected])

  React.useEffect(() => {
    const source = new EventSource(`${apiBase}/stream?c=${encodeURIComponent(name)}`)
    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as CanvasState
        const ids = new Set(next.frames.map((frame) => frame.id))
        const comments = new Set(next.comments.map((comment) => comment.id))
        setState(next)
        setConnected(true)
        setSelected((current) => (current && ids.has(current) ? current : null))
        setFocused((current) => (current && ids.has(current) ? current : null))
        setActiveComment((current) => (current && comments.has(current) ? current : null))
        setGroup((current) => current.filter((id) => ids.has(id)))
      } catch {}
    }
    source.onerror = () => setConnected(false)
    source.onopen = () => setConnected(true)
    return () => source.close()
  }, [apiBase, name])

  React.useEffect(
    () => () => {
      for (const cleanup of frameCleanups.current.values()) cleanup()
    },
    [],
  )

  const onFrameLoad = React.useCallback((id: string, element: HTMLIFrameElement) => {
    frameEls.current.set(id, element)
    frameCleanups.current.get(id)?.()
    const win = element.contentWindow
    if (!win) return
    try {
      let raf = 0
      const onScroll = () => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => setScrolls((prev) => ({ ...prev, [id]: { x: win.scrollX, y: win.scrollY } })))
      }
      // Keystrokes inside a frame never reach the canvas window. Without this, a click into a
      // focused frame (or a page that autofocuses an input) left C, V, D and Esc dead, so the
      // tool never switched and every click kept landing on the page instead of the canvas.
      const onKey = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase()
        if (key !== "escape" && (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey)) return
        if (!FRAME_KEYS.has(key)) return
        event.preventDefault()
        keyRef.current(event, true)
      }
      // Only the focused, interactive frame may hold the keyboard. A frame that grabs focus on its
      // own (autofocus, a hot reload) hands it straight back.
      const onFocusIn = () => {
        if (interactiveRef.current === id) return
        if (document.activeElement === element) reclaimFocus()
      }
      win.addEventListener("scroll", onScroll, { passive: true })
      win.addEventListener("keydown", onKey)
      win.addEventListener("focusin", onFocusIn)
      onFocusIn()
      setScrolls((prev) => ({ ...prev, [id]: { x: win.scrollX, y: win.scrollY } }))
      frameCleanups.current.set(id, () => {
        try {
          win.removeEventListener("scroll", onScroll)
          win.removeEventListener("keydown", onKey)
          win.removeEventListener("focusin", onFocusIn)
        } catch {}
      })
    } catch {}
  }, [])

  const placeDraft = React.useCallback(
    (frame: PlacedFrame, area: Area) => {
      const scroll = scrolls[frame.id] ?? { x: 0, y: 0 }
      const probeX = area.x + (area.width ?? 0) / 2
      const probeY = area.y + (area.height ?? 0) / 2
      let target
      try {
        const doc = frameEls.current.get(frame.id)?.contentDocument
        if (doc && frame.kind !== "image") target = describeTarget(doc, probeX, probeY)
      } catch {}
      setActiveComment(null)
      setSelected(frame.id)
      setDraft({ frameId: frame.id, ...area, scrollX: scroll.x, scrollY: scroll.y, target })
    },
    [scrolls],
  )

  /** Screen → canvas coordinates, frozen at the camera of the moment the gesture starts. */
  const worldMapper = () => {
    const rect = viewportRef.current!.getBoundingClientRect()
    const cam = cameraRef.current
    return (clientX: number, clientY: number): [number, number] => [
      (clientX - rect.left - cam.x) / cam.z,
      (clientY - rect.top - cam.y) / cam.z,
    ]
  }

  const frameAt = (x: number, y: number) =>
    layout.frames.findLast(
      (frame) => x >= frame.left && x <= frame.left + frame.width && y >= frame.top && y <= frame.top + frame.height,
    )

  /**
   * Comment and Draw run on one layer laid over every frame, hit-tested against the layout instead
   * of each frame's DOM. A click there can't fall into an iframe, a focused frame's page, a resize
   * handle or a stale per-frame shield, so one click always places the comment.
   */
  const startCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || space) return
    event.preventDefault()
    event.stopPropagation()
    reclaimFocus()
    if (tool === "draw") startInk(event)
    else startComment(event)
  }

  const startComment = (event: React.PointerEvent<HTMLDivElement>) => {
    const toWorld = worldMapper()
    const [wx, wy] = toWorld(event.clientX, event.clientY)
    const frame = frameAt(wx, wy)
    if (!frame) {
      setDraft(null)
      setActiveComment(null)
      return
    }
    const el = event.currentTarget
    const toLocal = (clientX: number, clientY: number) => {
      const [x, y] = toWorld(clientX, clientY)
      return {
        x: Math.min(frame.width, Math.max(0, x - frame.left)),
        y: Math.min(frame.height, Math.max(0, y - frame.top)),
      }
    }
    const start = toLocal(event.clientX, event.clientY)
    const startClient = { x: event.clientX, y: event.clientY }
    const between = (end: { x: number; y: number }): Area => ({
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    })
    const dragged = (next: PointerEvent) =>
      Math.abs(next.clientX - startClient.x) > DRAG_THRESHOLD || Math.abs(next.clientY - startClient.y) > DRAG_THRESHOLD
    try {
      el.setPointerCapture(event.pointerId)
    } catch {}
    setDraft(null)
    setActiveComment(null)
    let isArea = false
    const move = (next: PointerEvent) => {
      if (!isArea && !dragged(next)) return
      isArea = true
      setDragArea({ frameId: frame.id, ...between(toLocal(next.clientX, next.clientY)) })
    }
    const up = (next: PointerEvent) => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", cancel)
      setDragArea(null)
      placeDraft(frame, isArea ? between(toLocal(next.clientX, next.clientY)) : start)
    }
    const cancel = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", cancel)
      setDragArea(null)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", cancel)
  }

  const drawings = React.useMemo(() => state.drawings ?? [], [state.drawings])

  const pushUndo = (entry: Undo) => setUndoStack((stack) => [...stack.slice(-49), entry])

  const removeDrawings = (ids: string[], remember = true) => {
    if (!ids.length) return
    const gone = drawings.filter((drawing) => ids.includes(drawing.id))
    setState((prev) => ({ ...prev, drawings: (prev.drawings ?? []).filter((item) => !ids.includes(item.id)) }))
    if (remember && gone.length) pushUndo({ kind: "removed", drawings: gone })
    run(() => sendOp(apiBase, name, { op: "drawing.delete", ids }))
  }

  const addDrawing = async (stroke: Omit<InkStroke, "id">, target?: CanvasDrawing["target"]) => {
    const response = await sendOp(apiBase, name, { op: "drawing.add", ...stroke, target })
    return response.id ?? null
  }

  const undo = () => {
    const last = undoStack.at(-1)
    if (!last) return
    setUndoStack((stack) => stack.slice(0, -1))
    if (last.kind === "added") removeDrawings(last.ids, false)
    else
      run(async () => {
        for (const drawing of last.drawings) {
          const { id: _id, bounds: _bounds, author: _author, createdAt: _at, target, ...stroke } = drawing
          await addDrawing(stroke, target)
        }
      })
  }

  const clearDrawings = () => {
    const ids = drawings.map((drawing) => drawing.id)
    if (!ids.length) return
    removeDrawings(ids)
    toast(`Cleared ${ids.length} ${ids.length === 1 ? "drawing" : "drawings"}`, {
      action: { label: "Undo", onClick: () => undoRef.current() },
    })
  }
  const undoRef = React.useRef(undo)
  React.useLayoutEffect(() => {
    undoRef.current = undo
  })

  const startInk = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const toWorld = worldMapper()
    const zoom = cameraRef.current.z
    try {
      el.setPointerCapture(event.pointerId)
    } catch {}
    setDraft(null)
    setActiveComment(null)
    const listen = (move: (next: PointerEvent) => void, up: (next: PointerEvent) => void) => {
      const done = (next: PointerEvent) => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", done)
        el.removeEventListener("pointercancel", cancel)
        up(next)
      }
      const cancel = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", done)
        el.removeEventListener("pointercancel", cancel)
        setInkDraft(null)
        setErasing([])
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", done)
      el.addEventListener("pointercancel", cancel)
    }

    if (inkMode === "eraser") {
      const hit = new Set<string>()
      const sweep = (clientX: number, clientY: number) => {
        const world = toWorld(clientX, clientY)
        let changed = false
        for (const drawing of drawings) {
          if (hit.has(drawing.id)) continue
          const frame = drawing.frameId ? frameById.get(drawing.frameId) : undefined
          const offset = inkOffset(drawing, frame, drawing.frameId ? scrolls[drawing.frameId] : undefined)
          if (inkHit(drawing, world, offset, 8 / zoom)) {
            hit.add(drawing.id)
            changed = true
          }
        }
        if (changed) setErasing([...hit])
      }
      sweep(event.clientX, event.clientY)
      listen(
        (next) => sweep(next.clientX, next.clientY),
        () => {
          setErasing([])
          removeDrawings([...hit])
        },
      )
      return
    }

    const tool = inkMode
    const freehand = tool === "pen" || tool === "marker"
    const start = toWorld(event.clientX, event.clientY)
    // An arrow belongs to what it points at; everything else to where it starts.
    let frame = frameAt(start[0], start[1])
    const scrollOf = (id?: string) => (id ? (scrolls[id] ?? { x: 0, y: 0 }) : { x: 0, y: 0 })
    const local = (world: [number, number], anchor = frame): [number, number] =>
      anchor ? [world[0] - anchor.left, world[1] - anchor.top] : world
    const size = INK_SCREEN_SIZE[tool] / zoom
    let world: [number, number][] = [start]
    const draftOf = (anchor = frame): InkStroke => ({
      id: "ink-draft",
      tool,
      color: inkColor,
      size,
      frameId: anchor?.id ?? null,
      points: world.map((point) => local(point, anchor)),
      scrollX: scrollOf(anchor?.id).x,
      scrollY: scrollOf(anchor?.id).y,
    })
    setInkDraft(draftOf())
    listen(
      (next) => {
        const point = toWorld(next.clientX, next.clientY)
        if (freehand) {
          const last = world[world.length - 1]
          if (Math.hypot(point[0] - last[0], point[1] - last[1]) < 1.5 / zoom) return
          world = [...world, point]
        } else {
          let end = point
          if (next.shiftKey && tool !== "arrow") {
            const side = Math.max(Math.abs(point[0] - start[0]), Math.abs(point[1] - start[1]))
            end = [start[0] + Math.sign(point[0] - start[0] || 1) * side, start[1] + Math.sign(point[1] - start[1] || 1) * side]
          }
          world = [start, end]
        }
        setInkDraft(draftOf())
      },
      () => {
        setInkDraft(null)
        const end = world[world.length - 1]
        const tiny = Math.hypot(end[0] - start[0], end[1] - start[1]) < 4 / zoom
        if (!freehand && tiny) return
        if (tool === "arrow") frame = frameAt(end[0], end[1]) ?? frame
        const stroke = draftOf()
        const { id: _draftId, ...body } = stroke
        let target: CanvasDrawing["target"]
        if (frame && frame.kind !== "image") {
          const xs = stroke.points.map((point) => point[0])
          const ys = stroke.points.map((point) => point[1])
          const probe =
            tool === "arrow"
              ? stroke.points[1]
              : [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
          try {
            const doc = frameEls.current.get(frame.id)?.contentDocument
            if (doc) target = describeTarget(doc, probe[0], probe[1])
          } catch {}
        }
        const temp = `ink-${Date.now()}`
        const optimistic: CanvasDrawing = {
          ...body,
          id: temp,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          author: "owner",
          createdAt: new Date().toISOString(),
        }
        setState((prev) => ({ ...prev, drawings: [...(prev.drawings ?? []), optimistic] }))
        run(async () => {
          const id = await addDrawing(body, target)
          if (id) pushUndo({ kind: "added", ids: [id] })
        })
      },
    )
  }

  const changeTool = React.useCallback((next: Tool) => {
    setTool(next)
    if (next !== "move") reclaimFocus()
  }, [])

  const setInkMode = (mode: InkMode) => {
    setInkModeState(mode)
    savePref("ink-mode", mode)
  }

  const setInkColor = (color: CanvasInkColor) => {
    setInkColorState(color)
    savePref("ink-color", color)
    if (inkMode === "eraser") setInkMode("pen")
  }

  const escape = React.useCallback(() => {
    if (draft) setDraft(null)
    else if (activeComment) setActiveComment(null)
    else if (focused) exitFocus()
    else if (tool !== "move") setTool("move")
    else if (group.length) setGroup([])
    else if (selected) setSelected(null)
  }, [activeComment, draft, exitFocus, focused, group.length, selected, tool])

  const mixIds = React.useMemo(() => (group.length >= 2 ? group : []), [group])
  const targetIds = React.useMemo(
    () => (mixIds.length ? mixIds : (focused ?? selected) ? [(focused ?? selected)!] : []),
    [focused, mixIds, selected],
  )

  const run = React.useCallback(async (task: () => Promise<unknown>) => {
    try {
      await task()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }, [])

  const setVerdict = React.useCallback(
    (ids: string[], verdict: CanvasVerdict | null) => {
      if (!ids.length) return
      setState((prev) => ({
        ...prev,
        frames: prev.frames.map((frame) => {
          if (!ids.includes(frame.id)) return frame
          const next = { ...frame }
          if (verdict) next.verdict = verdict
          else delete next.verdict
          return next
        }),
      }))
      run(() => sendOp(apiBase, name, { op: "frame.verdict", ids, verdict }))
    },
    [apiBase, name, run],
  )

  const toggleVerdict = React.useCallback(
    (ids: string[], verdict: CanvasVerdict) => {
      const same = ids.every((id) => state.frames.find((frame) => frame.id === id)?.verdict === verdict)
      setVerdict(ids, same ? null : verdict)
    },
    [setVerdict, state.frames],
  )

  const ask = (kind: CanvasRequestKind, ids: string[], text: string) =>
    run(async () => {
      if (kind === "decide") setVerdict(ids, "pick")
      await sendOp(apiBase, name, { op: "request.add", kind, frameIds: ids, text })
      if (kind === "mix") setGroup([])
      setPanelOpen(true)
    })

  const selectFrame = (id: string, additive: boolean) => {
    if (additive) {
      setGroup((current) => {
        const base = current.length ? current : selected && selected !== id ? [selected] : []
        return base.includes(id) ? base.filter((item) => item !== id) : [...base, id]
      })
    } else setGroup([])
    setSelected(id)
    setActiveComment(null)
  }

  React.useEffect(() => {
    escapeRef.current = escape
  }, [escape])

  React.useLayoutEffect(() => {
    keyRef.current = (event: KeyboardEvent, fromFrame: boolean) => {
      if (event.key === "Escape") {
        if (fromFrame || !isTyping(event.target) || draft) escape()
        return
      }
      if (!fromFrame && isTyping(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (!fromFrame && event.code === "Space" && !event.repeat) {
        setSpace(true)
        event.preventDefault()
        return
      }
      if (mod && key === "z" && !event.shiftKey) {
        if (!undoStack.length) return
        event.preventDefault()
        undo()
        return
      }
      if (tool === "draw" && !mod && !event.shiftKey && INK_MODE_KEYS[key]) {
        setInkMode(INK_MODE_KEYS[key])
        return
      }
      if (mod && (event.key === "=" || event.key === "+")) {
        event.preventDefault()
        zoomBy(ZOOM_STEP)
      } else if (mod && event.key === "-") {
        event.preventDefault()
        zoomBy(1 / ZOOM_STEP)
      } else if (mod && event.key === "0") {
        event.preventDefault()
        zoomBy(1 / zoomTargetValue())
      } else if (mod) {
        return
      } else if (event.shiftKey && event.code === "Digit1") {
        fitAll()
      } else if (event.shiftKey && event.code === "Digit2") {
        if (selected) fitFrame(selected)
      } else if (VERDICT_KEY[event.key.toLowerCase()] && targetIds.length) {
        toggleVerdict(targetIds, VERDICT_KEY[event.key.toLowerCase()])
      } else if (key === "v") {
        changeTool("move")
      } else if (key === "c") {
        changeTool("comment")
      } else if (key === "d") {
        changeTool("draw")
      } else if ((key === "f" || event.key === "Enter") && selected) {
        if (focused) exitFocus()
        else focusFrame(selected)
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault()
        step(1)
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault()
        step(-1)
      }
    }
  })

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keyRef.current(event, false)
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpace(false)
    }
    // A Space released in another window (or after alt-tab) never sends keyup here; without this the
    // canvas stayed in pan mode and swallowed every comment click.
    const release = () => setSpace(false)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", release)
    document.addEventListener("visibilitychange", release)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", release)
      document.removeEventListener("visibilitychange", release)
    }
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (!event.currentTarget.contains(target)) return
    if (target.closest("[data-canvas-pin]")) return
    const onFrame = Boolean(target.closest("[data-frame]"))
    const wantsPan = event.button === 1 || space || (event.button === 0 && !onFrame && !target.closest("[data-canvas-label]"))
    if (!wantsPan) return
    event.preventDefault()
    const el = event.currentTarget
    try {
      el.setPointerCapture(event.pointerId)
    } catch {}
    let lastX = event.clientX
    let lastY = event.clientY
    let moved = false
    setPanning(true)
    const move = (next: PointerEvent) => {
      if (!next.buttons) {
        up()
        return
      }
      const dx = next.clientX - lastX
      const dy = next.clientY - lastY
      if (Math.abs(dx) + Math.abs(dy) > 0) moved = true
      lastX = next.clientX
      lastY = next.clientY
      panBy(dx, dy)
    }
    const up = () => {
      setPanning(false)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
      if (!moved && !onFrame && event.button === 0 && !space) {
        setSelected(null)
        setGroup([])
        setDraft(null)
        setActiveComment(null)
      }
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
  }

  const z = camera.z
  const firstRow = layout.rows[0]?.row
  const labelsFit = ROW_GAP * z > 76
  const framesLabeled = (row: string) => labelsFit || row === firstRow
  const rowLabeled = (row: string) => ROW_GAP * z > 34 || row === firstRow
  const toScreen = (x: number, y: number) => ({ left: camera.x + x * z, top: camera.y + y * z })

  const localOf = (comment: CanvasComment | CommentDraft) => {
    const frame = frameById.get(comment.frameId)
    if (!frame) return null
    const scroll = scrolls[comment.frameId] ?? { x: 0, y: 0 }
    return { frame, x: comment.x + comment.scrollX - scroll.x, y: comment.y + comment.scrollY - scroll.y }
  }

  const pinPosition = (comment: CanvasComment | CommentDraft) => {
    const local = localOf(comment)
    if (!local) return null
    const { frame } = local
    const right = local.x + (comment.width ?? 0)
    const bottom = local.y + (comment.height ?? 0)
    if (right < 0 || bottom < 0 || local.x > frame.width || local.y > frame.height) return null
    return toScreen(frame.left + Math.max(0, local.x), frame.top + Math.max(0, local.y))
  }

  const areaRect = (comment: Area & { frameId: string; scrollX?: number; scrollY?: number }) => {
    if (!comment.width || !comment.height) return null
    const frame = frameById.get(comment.frameId)
    if (!frame) return null
    const scroll = comment.scrollX === undefined ? { x: 0, y: 0 } : (scrolls[comment.frameId] ?? { x: 0, y: 0 })
    const x0 = Math.max(0, comment.x + (comment.scrollX ?? 0) - scroll.x)
    const y0 = Math.max(0, comment.y + (comment.scrollY ?? 0) - scroll.y)
    const x1 = Math.min(frame.width, comment.x + (comment.scrollX ?? 0) - scroll.x + comment.width)
    const y1 = Math.min(frame.height, comment.y + (comment.scrollY ?? 0) - scroll.y + comment.height)
    if (x1 <= x0 || y1 <= y0) return null
    const at = toScreen(frame.left + x0, frame.top + y0)
    return { ...at, width: (x1 - x0) * z, height: (y1 - y0) * z }
  }

  const renderArea = (
    key: string,
    comment: Area & { frameId: string; scrollX?: number; scrollY?: number },
    tone: "active" | "open" | "resolved",
  ) => {
    const rect = areaRect(comment)
    if (!rect) return null
    return (
      <div
        key={key}
        aria-hidden
        style={rect}
        className={cn(
          "absolute transition-[background-color,border-color] duration-fast ease-out",
          tone === "active" && "rounded-[3px] border-2 border-dashed border-brand bg-brand/12",
          tone === "open" && "rounded-[3px] border-[1.5px] border-dashed border-brand bg-brand/8",
          tone === "resolved" && "rounded-[3px] border border-dashed border-foreground/30",
        )}
      />
    )
  }

  const commitSize = (size: Resize) => {
    setState((prev) => ({
      ...prev,
      frames: prev.frames.map((item) =>
        item.id === size.id ? { ...item, width: size.width, height: size.height } : item,
      ),
    }))
    run(() => sendOp(apiBase, name, { op: "frame.resize", ...size }))
  }

  const resetSize = (frame: PlacedFrame, edge: Edge) => {
    const width = edge === "y" ? frame.width : (frame.originalWidth ?? frame.width)
    const height = edge === "x" ? frame.height : (frame.originalHeight ?? frame.height)
    if (width === frame.width && height === frame.height) return
    commitSize({ id: frame.id, width, height })
  }

  const startResize = (frame: PlacedFrame, edge: Edge, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const el = event.currentTarget
    try {
      el.setPointerCapture(event.pointerId)
    } catch {}
    const startX = event.clientX
    const startY = event.clientY
    const base = { width: frame.width, height: frame.height }
    const zoom = camera.z
    let current: Resize = { id: frame.id, ...base }
    setSelected(frame.id)
    setDraft(null)
    setActiveComment(null)
    setResize(current)
    const move = (next: PointerEvent) => {
      if (!next.buttons) {
        up()
        return
      }
      let width = edge === "y" ? base.width : base.width + (next.clientX - startX) / zoom
      const height = edge === "x" ? base.height : base.height + (next.clientY - startY) / zoom
      if (edge !== "y" && !next.altKey) width = snapWidth(width, 10 / zoom)
      current = { id: frame.id, ...clampFrameSize(width, height) }
      setResize(current)
    }
    const up = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
      setResize(null)
      if (current.width === base.width && current.height === base.height) return
      commitSize(current)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
  }

  const reload = (id: string) => setReloadKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  const openFrame = (id: string) => {
    const frame = frameById.get(id)
    if (frame) window.open(frame.src, "_blank", "noopener")
  }

  const visibleComments = state.comments.filter((comment) => showResolved || !comment.resolved)
  const openCount = state.comments.filter((comment) => !comment.resolved).length
  const asked = (state.requests ?? []).filter((request) => request.status === "open")
  const decisionOf = (row: string) => (state.decisions ?? []).filter((decision) => decision.row === row).at(-1)
  const titleOf = (id: string) => frameById.get(id)?.title ?? id
  const groupVerdict = (ids: string[]) => {
    const first = frameById.get(ids[0])?.verdict ?? null
    return ids.every((id) => (frameById.get(id)?.verdict ?? null) === first) ? first : null
  }
  const pickRequest = (request: CanvasRequest) => {
    const first = request.frameIds[0]
    if (!first || !frameById.has(first)) return
    setGroup(request.frameIds.length > 1 ? request.frameIds : [])
    setSelected(first)
    fitFrame(first)
  }
  const contextFrame = (focused ?? selected) ? frameById.get((focused ?? selected)!) : undefined
  const contextIndex = contextFrame ? layout.frames.findIndex((frame) => frame.id === contextFrame.id) + 1 : 0
  const cursor = panning ? "cursor-grabbing" : space ? "cursor-grab" : tool !== "move" ? "cursor-crosshair" : "cursor-default"
  const interactiveId = focused && tool === "move" && !space && !resize ? focused : null
  React.useEffect(() => {
    interactiveRef.current = interactiveId
    if (!interactiveId) reclaimFocus()
  }, [interactiveId])

  const strokes: InkStroke[] = [
    ...(erasing.length ? drawings.filter((drawing) => !erasing.includes(drawing.id)) : drawings),
    ...(inkDraft ? [inkDraft] : []),
  ]

  return (
    <div className="fixed inset-0 overflow-clip bg-(--canvas-ground) text-foreground antialiased [--canvas-ground:color-mix(in_oklab,var(--background),var(--foreground)_2%)] [--canvas-stroke:color-mix(in_oklab,var(--foreground)_10%,transparent)] [--grid-major:color-mix(in_oklab,var(--foreground)_7%,transparent)]">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onAuxClick={(event) => event.button === 1 && event.preventDefault()}
        className={cn("absolute inset-0 touch-none select-none overflow-clip", cursor)}
        style={{
          backgroundImage: [
            "linear-gradient(to right, var(--grid-major) 1px, transparent 1px)",
            "linear-gradient(to bottom, var(--grid-major) 1px, transparent 1px)",
            "linear-gradient(to right, var(--grid-minor) 1px, transparent 1px)",
            "linear-gradient(to bottom, var(--grid-minor) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: [grid * 4, grid * 4, grid, grid].map((size) => `${size}px ${size}px`).join(", "),
          backgroundPosition: `${camera.x}px ${camera.y}px`,
          ["--grid-minor" as string]: `color-mix(in oklab, var(--foreground) ${Math.round(Math.min(1, Math.max(0, (z - 0.06) / 0.24)) * 35) / 10}%, transparent)`,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${z})` }}
        >
          {layout.frames.map((frame) => {
            const interactive = focused === frame.id && tool === "move" && !space && !resize
            return (
              <FrameView
                key={frame.id}
                frame={frame}
                interactive={interactive}
                dimmed={Boolean(focused && focused !== frame.id)}
                out={frame.verdict === "out"}
                lifted={selected === frame.id || group.includes(frame.id)}
                reloadKey={reloadKeys[frame.id] ?? 0}
                onFrameLoad={onFrameLoad}
                shield={
                  <div
                    className={cn("absolute inset-0", space ? "cursor-grab" : "cursor-pointer")}
                    onPointerEnter={() => setHovered(frame.id)}
                    onPointerLeave={() => setHovered((current) => (current === frame.id ? null : current))}
                    onClick={(event) => {
                      if (space || tool !== "move") return
                      selectFrame(frame.id, event.shiftKey)
                    }}
                    onDoubleClick={() => tool === "move" && focusFrame(frame.id)}
                  />
                }
              />
            )
          })}
          <InkLayer strokes={strokes} frameById={frameById} scrolls={scrolls} focused={focused} />
        </div>

        {tool !== "move" && !space && (
          <div
            data-canvas-capture={tool}
            aria-hidden
            onPointerDown={startCapture}
            className={cn("absolute inset-0", cursor)}
          />
        )}

        <div className="pointer-events-none absolute inset-0">
          {layout.rows.length > 1 || (layout.rows[0] && layout.rows[0].row !== "Frames")
            ? layout.rows.map((row, index) => {
                const at = toScreen(row.left, row.top)
                const decision = decisionOf(row.row)
                return (
                  <div
                    key={row.row}
                    style={{ left: at.left, top: at.top - (framesLabeled(row.row) ? ROW_LABEL_GAP : DIM_GAP) }}
                    className={cn(
                      "absolute flex -translate-y-full items-baseline gap-2.5 text-base font-semibold tracking-tight whitespace-nowrap text-foreground transition-opacity duration-base ease-out",
                      (focused || !rowLabeled(row.row)) && "opacity-0",
                    )}
                  >
                    <span className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-xs font-medium text-muted-foreground tabular-nums ring-1 ring-(--canvas-stroke)">{String(index + 1).padStart(2, "0")}</span>
                    {row.row}
                    {decision && (
                      <span className="flex min-w-0 items-baseline gap-2 text-sm font-normal tracking-normal text-muted-foreground">
                        <span aria-hidden>·</span>
                        {decision.winner ? `Chose ${titleOf(decision.winner)}` : "Decided"}
                        <span className="max-w-[40ch] truncate">{decision.why}</span>
                      </span>
                    )}
                  </div>
                )
              })
            : null}

          {layout.frames.map((frame) => {
            const at = toScreen(frame.left, frame.top)
            const width = frame.width * z
            const isSelected = selected === frame.id || group.includes(frame.id)
            const isHovered = hovered === frame.id && !isSelected
            const resizing = resize?.id === frame.id
            const openHere = state.comments.filter((comment) => comment.frameId === frame.id && !comment.resolved).length
            const showDims = width > 56
            const rowFrames = layout.frames.filter((item) => item.row === frame.row)
            const showHeight =
              showDims && frame.height * z > 96 && (rowFrames[0]?.id === frame.id || rowFrames[0]?.height !== frame.height)
            return (
              <React.Fragment key={frame.id}>
                <button
                  type="button"
                  data-canvas-label=""
                  onClick={(event) => selectFrame(frame.id, event.shiftKey)}
                  onDoubleClick={() => focusFrame(frame.id)}
                  style={{ left: at.left, top: at.top - (showDims ? LABEL_GAP : DIM_GAP), maxWidth: Math.max(width, 24) }}
                  className={cn(
                    "pointer-events-auto absolute flex -translate-y-full cursor-pointer items-center gap-2 truncate text-left text-sm font-medium outline-none",
                    "transition-[color,opacity] duration-fast ease-out focus-visible:underline",
                    isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    focused && focused !== frame.id && "opacity-0",
                    !focused && !isSelected && !framesLabeled(frame.row) && "pointer-events-none opacity-0",
                  )}
                >
                  {frame.verdict && <VerdictMark verdict={frame.verdict} />}
                  <span className={cn("truncate", frame.verdict === "out" && "text-muted-foreground/70 line-through decoration-muted-foreground/50")}>
                    {frame.title}
                  </span>
                  {frame.frozen && width > 160 && <span className="shrink-0 text-xs text-muted-foreground/70">Frozen</span>}
                  {openHere > 0 && width > 120 && (
                    <span className="flex h-4 shrink-0 items-center gap-0.5 rounded-full bg-brand px-1.5 text-[0.625rem] font-semibold text-brand-foreground tabular-nums">
                      <ChatCircle weight="bold" className="size-2.5" aria-hidden />
                      {openHere}
                    </span>
                  )}
                </button>
                {showDims && (
                  <Dimension
                    left={at.left}
                    top={at.top - DIM_GAP}
                    length={width}
                    value={frame.width}
                    hidden={Boolean(focused ? focused !== frame.id : !framesLabeled(frame.row) && !isSelected)}
                  />
                )}
                {showHeight && (
                  <Dimension
                    vertical
                    left={at.left - DIM_GAP}
                    top={at.top}
                    length={frame.height * z}
                    value={frame.height}
                    hidden={Boolean(focused ? focused !== frame.id : !framesLabeled(frame.row) && !isSelected)}
                  />
                )}
                {(isSelected || isHovered) && (
                  <div
                    aria-hidden
                    style={{ left: at.left, top: at.top, width, height: frame.height * z }}
                    className={cn("absolute", isSelected ? "rounded-[3px] ring-2 ring-brand" : "rounded-[3px] ring-1 ring-foreground/30")}
                  />
                )}
                {(isSelected || isHovered || resizing) &&
                  tool === "move" &&
                  !space &&
                  !(focused && focused !== frame.id) &&
                  (["x", "y", "xy"] as const).map((edge) => {
                    const height = frame.height * z
                    const box =
                      edge === "x"
                        ? { left: at.left + width - 6, top: at.top, width: 12, height }
                        : edge === "y"
                          ? { left: at.left, top: at.top + height - 6, width, height: 12 }
                          : { left: at.left + width - 10, top: at.top + height - 10, width: 20, height: 20 }
                    return (
                      <div
                        key={edge}
                        data-canvas-handle={edge}
                        style={box}
                        title="Drag to resize · double-click to reset"
                        onPointerDown={(event) => startResize(frame, edge, event)}
                        onDoubleClick={(event) => {
                          event.stopPropagation()
                          resetSize(frame, edge)
                        }}
                        onPointerEnter={() => setHovered(frame.id)}
                        onPointerLeave={() => !resize && setHovered((current) => (current === frame.id ? null : current))}
                        className={cn(
                          "group/handle pointer-events-auto absolute flex touch-none items-center justify-center",
                          edge === "x" ? "cursor-ew-resize" : edge === "y" ? "cursor-ns-resize" : "cursor-nwse-resize",
                        )}
                      >
                        <span
                          className={cn(
                            "bg-brand shadow-sm ring-1 ring-brand-foreground/40 transition-[opacity,scale] duration-fast ease-out",
                            edge === "x" && "h-7 w-1 rounded-full group-hover/handle:scale-y-125",
                            edge === "y" && "h-1 w-7 rounded-full group-hover/handle:scale-x-125",
                            edge === "xy" && "size-2.5 rounded-[2px]",
                            !isSelected && !resizing && "opacity-60",
                          )}
                        />
                      </div>
                    )
                  })}
                {resizing && (
                  <div
                    aria-hidden
                    style={{ left: at.left + width, top: at.top + frame.height * z + 16 }}
                    className="absolute flex -translate-x-full items-center gap-1.5 rounded-md bg-popover px-2 py-1 font-mono text-[0.6875rem] leading-none whitespace-nowrap text-popover-foreground shadow-lg ring-1 ring-(--canvas-stroke) tabular-nums"
                  >
                    <span className="font-medium">
                      {frame.width} × {frame.height}
                    </span>
                    <span className="rounded-sm bg-brand px-1 py-0.5 text-brand-foreground uppercase">{breakpointOf(frame.width)}</span>
                  </div>
                )}
              </React.Fragment>
            )
          })}

          {visibleComments.map((comment) =>
            renderArea(
              `area-${comment.id}`,
              comment,
              activeComment === comment.id ? "active" : comment.resolved ? "resolved" : "open",
            ),
          )}
          {draft && renderArea("area-draft", draft, "active")}
          {dragArea && renderArea("area-drag", dragArea, "active")}

          {visibleComments.map((comment) => {
            const at = pinPosition(comment)
            if (!at) return null
            return (
              <CommentPin
                key={comment.id}
                comment={comment}
                number={numberOf(comment.id)}
                left={at.left}
                top={at.top}
                active={activeComment === comment.id}
                onOpenChange={(open) => {
                  setDraft(null)
                  setActiveComment(open ? comment.id : null)
                  if (open) setSelected(comment.frameId)
                }}
                onReply={(text) => run(() => sendOp(apiBase, name, { op: "comment.reply", id: comment.id, text }))}
                onResolve={(resolved) =>
                  run(async () => {
                    await sendOp(apiBase, name, { op: "comment.resolve", id: comment.id, resolved })
                    if (resolved && !showResolved) setActiveComment(null)
                  })
                }
                onDelete={() =>
                  run(async () => {
                    await sendOp(apiBase, name, { op: "comment.delete", id: comment.id })
                    setActiveComment(null)
                  })
                }
              />
            )
          })}

          {draft &&
            (() => {
              const at = pinPosition(draft)
              if (!at) return null
              return (
                <DraftPin
                  key={`${draft.frameId}-${draft.x}-${draft.y}`}
                  left={at.left}
                  top={at.top}
                  number={state.comments.length + 1}
                  onCancel={() => setDraft(null)}
                  onSubmit={(text) =>
                    run(async () => {
                      await sendOp(apiBase, name, { op: "comment.add", ...draft, text })
                      setDraft(null)
                      setPanelOpen(true)
                    })
                  }
                />
              )
            })()}
        </div>

        {layout.frames.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <EmptyNote className="max-w-md" title="Nothing on this canvas yet">
              Ask an agent to add a variant, or run{" "}
              <code className="font-mono text-sm text-foreground">
                {command} add --route /… --title …
              </code>
            </EmptyNote>
          </div>
        )}
      </div>

      <header className="pointer-events-none absolute top-4 left-5 z-10 flex max-w-[calc(100%-2.5rem)] flex-col gap-0.5">
        <h1 className="flex items-center gap-2 truncate text-base font-semibold tracking-tight text-foreground">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_22%,transparent)]" />
          {state.title}
        </h1>
        <p className="pl-4 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
          {state.frames.length} {state.frames.length === 1 ? "frame" : "frames"}
          {openCount > 0 && ` · ${openCount} open`}
          {asked.length > 0 && ` · ${asked.length} asked`}
          {!connected && " · offline"}
        </p>
      </header>

      {mixIds.length >= 2 ? (
        <Toolbar aria-label="Selection" className="absolute top-3 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
          <ToolbarTitle className="tabular-nums">{mixIds.length} frames</ToolbarTitle>
          <ToolbarSeparator />
          <VerdictGroup value={groupVerdict(mixIds)} onChange={(verdict) => setVerdict(mixIds, verdict)} />
          <ToolbarSeparator />
          <RequestButton
            kind="mix"
            names={mixIds.map(titleOf)}
            open={asking === "mix"}
            onOpenChange={(open) => setAsking(open ? "mix" : null)}
            onSubmit={(text) => ask("mix", mixIds, text)}
          />
          <ToolbarButton tooltip="Clear selection" shortcut="Esc" onClick={() => setGroup([])}>
            <X weight="bold" />
          </ToolbarButton>
        </Toolbar>
      ) : contextFrame && (
        <Toolbar
          aria-label="Frame"
          className="absolute top-3 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2"
        >
          {focused && (
            <ToolbarButton tooltip="Previous" shortcut="←" onClick={() => step(-1)}>
              <CaretLeft weight="bold" />
            </ToolbarButton>
          )}
          <ToolbarTitle className="max-w-72">{contextFrame.title}</ToolbarTitle>
          <span className="pr-1.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {focused ? `${contextIndex} / ${layout.frames.length}` : `${contextFrame.width} × ${contextFrame.height}`}
          </span>
          {focused && (
            <ToolbarButton tooltip="Next" shortcut="→" onClick={() => step(1)}>
              <CaretRight weight="bold" />
            </ToolbarButton>
          )}
          <ToolbarSeparator />
          {contextFrame.kind !== "image" && (
            <ToolbarButton tooltip="Reload" onClick={() => reload(contextFrame.id)}>
              <ArrowClockwise weight="bold" />
            </ToolbarButton>
          )}
          <ToolbarButton tooltip="Open in a new tab" onClick={() => openFrame(contextFrame.id)}>
            <ArrowSquareOut weight="bold" />
          </ToolbarButton>
          {focused ? (
            <ToolbarButton tooltip="Exit focus" shortcut="Esc" onClick={exitFocus}>
              <CornersIn weight="bold" />
            </ToolbarButton>
          ) : (
            <ToolbarButton tooltip="Focus" shortcut="F" onClick={() => focusFrame(contextFrame.id)}>
              <CornersOut weight="bold" />
            </ToolbarButton>
          )}
          <ToolbarSeparator />
          <VerdictGroup value={contextFrame.verdict ?? null} onChange={(verdict) => setVerdict([contextFrame.id], verdict)} />
          <ToolbarSeparator />
          <RequestButton
            kind="more"
            names={[contextFrame.title]}
            open={asking === "more"}
            onOpenChange={(open) => setAsking(open ? "more" : null)}
            onSubmit={(text) => ask("more", [contextFrame.id], text)}
          />
          <RequestButton
            kind="decide"
            names={[contextFrame.title]}
            open={asking === "decide"}
            onOpenChange={(open) => setAsking(open ? "decide" : null)}
            onSubmit={(text) => ask("decide", [contextFrame.id], text)}
          />
        </Toolbar>
      )}

      <Toolbar
        aria-label="Tools"
        className="absolute bottom-4 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2"
      >
        <ToolbarToggleGroup
          type="single"
          value={tool}
          onValueChange={(value) => value && changeTool(value as Tool)}
          aria-label="Tool"
        >
          <ToolbarToggleItem value="move" tooltip="Move" shortcut="V" aria-label="Move">
            <Cursor weight="bold" />
          </ToolbarToggleItem>
          <ToolbarToggleItem value="comment" tooltip="Comment" shortcut="C" aria-label="Comment">
            <ChatCircle weight="bold" />
          </ToolbarToggleItem>
          <ToolbarToggleItem value="draw" tooltip="Draw" shortcut="D" aria-label="Draw">
            <PencilSimple weight="bold" />
          </ToolbarToggleItem>
        </ToolbarToggleGroup>
        <ToolbarSeparator />
        <ToolbarButton tooltip="Zoom out" shortcut="Ctrl −" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <Minus weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Zoom to 100%"
          shortcut="Ctrl 0"
          className="w-14 text-xs font-medium tabular-nums"
          onClick={() => zoomBy(1 / zoomTargetValue())}
        >
          {Math.round(z * 100)}%
        </ToolbarButton>
        <ToolbarButton tooltip="Zoom in" shortcut="Ctrl +" onClick={() => zoomBy(ZOOM_STEP)}>
          <Plus weight="bold" />
        </ToolbarButton>
        <ToolbarButton tooltip="Fit all frames" shortcut="⇧1" onClick={() => fitAll()}>
          <FrameCorners weight="bold" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton
          tooltip="Comments"
          pressed={panelOpen}
          aria-label="Comments"
          className="relative"
          onClick={() => setPanelOpen((open) => !open)}
        >
          <ChatsCircle weight="bold" />
          {openCount + asked.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[0.625rem] leading-none font-semibold text-brand-foreground tabular-nums ring-2 ring-popover">
              {openCount + asked.length}
            </span>
          )}
        </ToolbarButton>
      </Toolbar>

      {tool === "draw" && (
        <InkToolbar
          mode={inkMode}
          color={inkColor}
          canUndo={undoStack.length > 0}
          count={drawings.length}
          onModeChange={setInkMode}
          onColorChange={setInkColor}
          onUndo={undo}
          onClear={clearDrawings}
        />
      )}

      {panelOpen && (
        <CommentsPanel
          comments={state.comments}
          requests={asked}
          onPickRequest={pickRequest}
          onCancelRequest={(request) => run(() => sendOp(apiBase, name, { op: "request.cancel", id: request.id }))}
          frameOrder={layout.frames.map((frame) => frame.id)}
          numberOf={numberOf}
          frameTitle={(id) => frameById.get(id)?.title ?? id}
          showResolved={showResolved}
          onShowResolvedChange={setShowResolved}
          onClose={() => setPanelOpen(false)}
          onResolve={(comment, resolved) => run(() => sendOp(apiBase, name, { op: "comment.resolve", id: comment.id, resolved }))}
          onPick={(comment) => {
            const frame = frameById.get(comment.frameId)
            const rect = viewportRef.current?.getBoundingClientRect()
            setSelected(comment.frameId)
            setDraft(null)
            if (comment.resolved) setShowResolved(true)
            if (frame && rect) {
              const zoom = Math.max(cameraRef.current.z, 0.5)
              const wx = frame.left + comment.x
              const wy = frame.top + comment.y
              const usable = rect.width - 344
              flyTo({ z: zoom, x: usable / 2 - wx * zoom, y: rect.height / 2 - wy * zoom })
            }
            setTimeout(() => setActiveComment(comment.id), 480)
          }}
        />
      )}
    </div>
  )
}
