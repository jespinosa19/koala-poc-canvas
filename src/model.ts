import { clampFrameSize } from "./frame-size.mjs"

export type CanvasFrameKind = "route" | "url" | "image"

export type CanvasVerdict = "pick" | "maybe" | "out"

export const VERDICTS: readonly CanvasVerdict[] = ["pick", "maybe", "out"]

export interface CanvasFrozen {
  kind: CanvasFrameKind
  src: string
  at: string
}

export interface CanvasFrame {
  id: string
  title: string
  kind: CanvasFrameKind
  src: string
  width: number
  height: number
  originalWidth?: number
  originalHeight?: number
  row: string
  note?: string
  verdict?: CanvasVerdict
  from?: string
  frozen?: CanvasFrozen
  createdAt: string
  updatedAt: string
}

export type CanvasRequestKind = "more" | "mix" | "decide"

export const REQUEST_KINDS: readonly CanvasRequestKind[] = ["more", "mix", "decide"]

export interface CanvasRequest {
  id: string
  kind: CanvasRequestKind
  frameIds: string[]
  text: string
  status: "open" | "done" | "cancelled"
  answer?: string
  made?: string[]
  createdAt: string
  updatedAt: string
}

export interface CanvasDecision {
  id: string
  row: string
  winner: string | null
  others: string[]
  why: string
  createdAt: string
}

export interface CanvasCommentTarget {
  selector: string
  text: string
}

export interface CanvasReply {
  id: string
  author: "owner" | "agent"
  text: string
  createdAt: string
}

export interface CanvasComment {
  id: string
  frameId: string
  x: number
  y: number
  width?: number
  height?: number
  scrollX: number
  scrollY: number
  text: string
  author: "owner" | "agent"
  target?: CanvasCommentTarget
  resolved: boolean
  resolution?: string
  replies: CanvasReply[]
  createdAt: string
  updatedAt: string
}

export type CanvasInkTool = "pen" | "marker" | "arrow" | "rect" | "ellipse"

export const INK_TOOLS: readonly CanvasInkTool[] = ["pen", "marker", "arrow", "rect", "ellipse"]

export type CanvasInkColor = "lime" | "red" | "amber" | "blue" | "white"

export const INK_COLORS: readonly CanvasInkColor[] = ["lime", "red", "amber", "blue", "white"]

/**
 * A freehand mark the owner drew to explain something. On a frame (`frameId` set) the points are in
 * that frame's pixels, at the frame's scroll when it was drawn (like a comment), so it follows the
 * frame when the layout moves. Off a frame (`frameId: null`) the points are canvas coordinates.
 * pen/marker: the polyline; arrow: tail then head; rect/ellipse: two opposite corners.
 */
export interface CanvasDrawing {
  id: string
  tool: CanvasInkTool
  color: CanvasInkColor
  size: number
  frameId: string | null
  points: [number, number][]
  scrollX: number
  scrollY: number
  bounds: { x: number; y: number; width: number; height: number }
  target?: CanvasCommentTarget
  author: "owner" | "agent"
  createdAt: string
}

export function inkBounds(points: [number, number][], size = 0) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of points) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, width: 0, height: 0 }
  const pad = size / 2
  return {
    x: Math.round(x0 - pad),
    y: Math.round(y0 - pad),
    width: Math.round(x1 - x0 + size),
    height: Math.round(y1 - y0 + size),
  }
}

export interface CanvasContext {
  selected: string | null
  focused: string | null
  viewport: { x: number; y: number; zoom: number } | null
  theme?: string | null
  updatedAt: string | null
}

export interface CanvasState {
  version: 1
  name: string
  title: string
  rev: number
  frames: CanvasFrame[]
  comments: CanvasComment[]
  requests?: CanvasRequest[]
  decisions?: CanvasDecision[]
  drawings?: CanvasDrawing[]
  context: CanvasContext
  createdAt: string
  updatedAt: string
}

export function now() {
  return new Date().toISOString()
}

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "frame"
  )
}

export function uniqueId(base: string, taken: Iterable<string>) {
  const used = new Set(taken)
  const root = slugify(base)
  if (!used.has(root)) return root
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`
    if (!used.has(candidate)) return candidate
  }
}

export function shortId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyCanvas(name: string, title?: string): CanvasState {
  const stamp = now()
  return {
    version: 1,
    name,
    title: title ?? name,
    rev: 0,
    frames: [],
    comments: [],
    context: { selected: null, focused: null, viewport: null, updatedAt: null },
    createdAt: stamp,
    updatedAt: stamp,
  }
}

export interface ContextChange {
  selected?: string | null
  focused?: string | null
  viewport?: { x: number; y: number; zoom: number }
  theme?: string | null
}

export function nextContext(current: CanvasContext, change: ContextChange): CanvasContext | null {
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value)
  const next: CanvasContext = { ...current }
  if (change.selected !== undefined) next.selected = change.selected
  if (change.focused !== undefined) next.focused = change.focused
  if (change.viewport && finite(change.viewport.x) && finite(change.viewport.y) && finite(change.viewport.zoom)) {
    next.viewport = {
      x: Math.round(change.viewport.x),
      y: Math.round(change.viewport.y),
      zoom: Math.round(change.viewport.zoom * 1000) / 1000,
    }
  }
  if (change.theme !== undefined) next.theme = typeof change.theme === "string" && /^[a-z0-9-]{1,40}$/i.test(change.theme) ? change.theme : null
  const same =
    (next.theme ?? null) === (current.theme ?? null) &&
    next.selected === current.selected &&
    next.focused === current.focused &&
    JSON.stringify(next.viewport) === JSON.stringify(current.viewport)
  return same ? null : { ...next, updatedAt: now() }
}

export function resizeFrame(state: CanvasState, id: string, width: unknown, height: unknown) {
  const frame = state.frames.find((item) => item.id === id)
  if (!frame) throw new Error(`No frame "${id}"`)
  const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)
  if (!finite(width) || !finite(height)) throw new Error("A resize needs width and height")
  const size = clampFrameSize(width, height)
  frame.originalWidth ??= frame.width
  frame.originalHeight ??= frame.height
  frame.width = size.width
  frame.height = size.height
  if (frame.width === frame.originalWidth && frame.height === frame.originalHeight) {
    delete frame.originalWidth
    delete frame.originalHeight
  }
  frame.updatedAt = now()
}

export function openRequests(state: CanvasState) {
  return (state.requests ?? []).filter((request) => request.status === "open")
}

export function decisionFor(state: CanvasState, row: string) {
  return (state.decisions ?? []).findLast((decision) => decision.row === row) ?? null
}

export function insertAfterFamily(frames: CanvasFrame[], frame: CanvasFrame, sourceId: string) {
  const family = new Set([sourceId])
  let at = frames.findIndex((item) => item.id === sourceId)
  if (at === -1) return [...frames, frame]
  for (let i = at + 1; i < frames.length; i++) {
    const item = frames[i]
    if (!item.from || !family.has(item.from)) break
    family.add(item.id)
    at = i
  }
  return [...frames.slice(0, at + 1), frame, ...frames.slice(at + 1)]
}

export function rowsOf(frames: CanvasFrame[]) {
  const order: string[] = []
  const rows = new Map<string, CanvasFrame[]>()
  for (const frame of frames) {
    if (!rows.has(frame.row)) {
      rows.set(frame.row, [])
      order.push(frame.row)
    }
    rows.get(frame.row)!.push(frame)
  }
  return order.map((row) => ({ row, frames: rows.get(row)! }))
}
