"use client"

import * as React from "react"
import { ArrowUUpLeft, ArrowUpRight, Backspace, Broom, Circle, PaintBrush, PencilSimple, Square } from "koala-icons"

import { cn } from "@/lib/utils"
import type { CanvasDrawing, CanvasInkColor, CanvasInkTool } from "../store"
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarToggleGroup,
  ToolbarToggleItem,
} from "./canvas-toolbar"

import type { PlacedFrame } from "./camera"

export type InkMode = CanvasInkTool | "eraser"

export const INK_HEX: Record<CanvasInkColor, string> = {
  lime: "#a3e635",
  red: "#f43f5e",
  amber: "#f59e0b",
  blue: "#3b82f6",
  white: "#ffffff",
}

const INK_LABEL: Record<CanvasInkColor, string> = {
  lime: "Lime",
  red: "Red",
  amber: "Amber",
  blue: "Blue",
  white: "White",
}

/** Screen pixels: what the stroke looks like when drawn, whatever the zoom. */
export const INK_SCREEN_SIZE: Record<CanvasInkTool, number> = { pen: 3, marker: 18, arrow: 3, rect: 3, ellipse: 3 }

const MODES: { mode: InkMode; label: string; key: string; Icon: typeof PencilSimple }[] = [
  { mode: "pen", label: "Pen", key: "1", Icon: PencilSimple },
  { mode: "marker", label: "Marker", key: "2", Icon: PaintBrush },
  { mode: "arrow", label: "Arrow", key: "3", Icon: ArrowUpRight },
  { mode: "rect", label: "Box", key: "4", Icon: Square },
  { mode: "ellipse", label: "Circle", key: "5", Icon: Circle },
  { mode: "eraser", label: "Eraser", key: "E", Icon: Backspace },
]

export const INK_MODE_KEYS: Record<string, InkMode> = Object.fromEntries(
  MODES.map(({ mode, key }) => [key.toLowerCase(), mode]),
)

export type InkStroke = Pick<CanvasDrawing, "tool" | "color" | "size" | "frameId" | "points" | "scrollX" | "scrollY"> & {
  id: string
}

type Scroll = { x: number; y: number }

/** Where a drawing's points sit in canvas coordinates right now (frame drawings follow scroll). */
export function inkOffset(stroke: InkStroke, frame: PlacedFrame | undefined, scroll: Scroll | undefined) {
  if (!stroke.frameId || !frame) return { x: 0, y: 0 }
  const s = scroll ?? { x: 0, y: 0 }
  return { x: frame.left - (s.x - stroke.scrollX), y: frame.top - (s.y - stroke.scrollY) }
}

function arrowPath([a, b]: [number, number][], size: number) {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  const head = Math.max(size * 4, Math.min(28 * (size / 3), Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.6))
  const left = [b[0] - head * Math.cos(angle - 0.45), b[1] - head * Math.sin(angle - 0.45)]
  const right = [b[0] - head * Math.cos(angle + 0.45), b[1] - head * Math.sin(angle + 0.45)]
  return `M${a[0]} ${a[1]}L${b[0]} ${b[1]}M${left[0]} ${left[1]}L${b[0]} ${b[1]}L${right[0]} ${right[1]}`
}

function smoothPath(points: [number, number][]) {
  if (points.length === 1) return `M${points[0][0]} ${points[0][1]}l0.01 0`
  if (points.length === 2) return `M${points[0][0]} ${points[0][1]}L${points[1][0]} ${points[1][1]}`
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`
  }
  const last = points[points.length - 1]
  return `${d}L${last[0]} ${last[1]}`
}

export function InkShape({ stroke, faded = false }: { stroke: InkStroke; faded?: boolean }) {
  const common = {
    fill: "none",
    stroke: INK_HEX[stroke.color] ?? INK_HEX.lime,
    strokeWidth: stroke.size,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: faded ? 0.25 : 1,
  }
  const [a, b] = stroke.points
  if (stroke.tool === "rect" && a && b) {
    return (
      <rect
        {...common}
        x={Math.min(a[0], b[0])}
        y={Math.min(a[1], b[1])}
        width={Math.abs(b[0] - a[0])}
        height={Math.abs(b[1] - a[1])}
        rx={Math.min(8 * (stroke.size / 3), Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2)}
      />
    )
  }
  if (stroke.tool === "ellipse" && a && b) {
    return (
      <ellipse
        {...common}
        cx={(a[0] + b[0]) / 2}
        cy={(a[1] + b[1]) / 2}
        rx={Math.abs(b[0] - a[0]) / 2}
        ry={Math.abs(b[1] - a[1]) / 2}
      />
    )
  }
  if (stroke.tool === "arrow" && a && b) return <path {...common} d={arrowPath([a, b], stroke.size)} />
  return (
    <path
      {...common}
      d={smoothPath(stroke.points)}
      strokeOpacity={stroke.tool === "marker" ? 0.4 : 1}
    />
  )
}

/** The drawings, in canvas coordinates, inside the zoomed layer so they scale with it. */
export function InkLayer({
  strokes,
  frameById,
  scrolls,
  focused,
}: {
  strokes: InkStroke[]
  frameById: Map<string, PlacedFrame>
  scrolls: Record<string, Scroll>
  focused: string | null
}) {
  // A mark drawn inside its frame scrolls with the page and is clipped to the frame; one that reaches
  // outside it (an arrow from the canvas into a frame) is never cut.
  const inside = (stroke: InkStroke) => {
    const frame = stroke.frameId ? frameById.get(stroke.frameId) : undefined
    if (!frame) return false
    return stroke.points.every(([x, y]) => x >= 0 && y >= 0 && x <= frame.width && y <= frame.height)
  }
  const clipped = new Set(strokes.filter(inside).map((stroke) => stroke.frameId!))
  return (
    <svg aria-hidden className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>
      <defs>
        {[...clipped].map((id) => {
          const frame = frameById.get(id)
          if (!frame) return null
          return (
            <clipPath key={id} id={`ink-clip-${id}`}>
              <rect x={frame.left} y={frame.top} width={frame.width} height={frame.height} />
            </clipPath>
          )
        })}
      </defs>
      {strokes.map((stroke) => {
        const frame = stroke.frameId ? frameById.get(stroke.frameId) : undefined
        if (stroke.frameId && !frame) return null
        const offset = inkOffset(stroke, frame, stroke.frameId ? scrolls[stroke.frameId] : undefined)
        const faded = Boolean(focused && stroke.frameId !== focused)
        return (
          <g key={stroke.id} clipPath={frame && inside(stroke) ? `url(#ink-clip-${frame.id})` : undefined}>
            <g transform={`translate(${offset.x} ${offset.y})`}>
              <InkShape stroke={stroke} faded={faded} />
            </g>
          </g>
        )
      })}
    </svg>
  )
}

/** The outline of a drawing as line segments, in its own coordinates, for the eraser. */
function outline(stroke: InkStroke): [number, number][] {
  const [a, b] = stroke.points
  if (stroke.tool === "rect" && a && b) return [a, [b[0], a[1]], b, [a[0], b[1]], a]
  if (stroke.tool === "ellipse" && a && b) {
    const cx = (a[0] + b[0]) / 2
    const cy = (a[1] + b[1]) / 2
    const rx = Math.abs(b[0] - a[0]) / 2
    const ry = Math.abs(b[1] - a[1]) / 2
    return Array.from({ length: 33 }, (_, i) => {
      const t = (i / 32) * Math.PI * 2
      return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as [number, number]
    })
  }
  return stroke.points
}

function segmentDistance(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Is the canvas point `world` within `slop` (canvas units) of the drawing? */
export function inkHit(stroke: InkStroke, world: [number, number], offset: { x: number; y: number }, slop: number) {
  const local: [number, number] = [world[0] - offset.x, world[1] - offset.y]
  const line = outline(stroke)
  const reach = slop + stroke.size / 2
  if (line.length === 1) return Math.hypot(local[0] - line[0][0], local[1] - line[0][1]) <= reach
  for (let i = 1; i < line.length; i++) if (segmentDistance(local, line[i - 1], line[i]) <= reach) return true
  return false
}

export function InkToolbar({
  mode,
  color,
  canUndo,
  count,
  onModeChange,
  onColorChange,
  onUndo,
  onClear,
}: {
  mode: InkMode
  color: CanvasInkColor
  canUndo: boolean
  count: number
  onModeChange: (mode: InkMode) => void
  onColorChange: (color: CanvasInkColor) => void
  onUndo: () => void
  onClear: () => void
}) {
  return (
    <Toolbar aria-label="Ink" className="absolute bottom-17 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
      <ToolbarToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => value && onModeChange(value as InkMode)}
        aria-label="Ink tool"
      >
        {MODES.map(({ mode: item, label, key, Icon }) => (
          <ToolbarToggleItem key={item} value={item} tooltip={label} shortcut={key} aria-label={label}>
            <Icon weight="bold" />
          </ToolbarToggleItem>
        ))}
      </ToolbarToggleGroup>
      <ToolbarSeparator />
      <div role="radiogroup" aria-label="Ink colour" className="flex items-center gap-0.5 px-1">
        {(Object.keys(INK_HEX) as CanvasInkColor[]).map((item) => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={color === item}
            aria-label={INK_LABEL[item]}
            title={INK_LABEL[item]}
            onClick={() => onColorChange(item)}
            className={cn(
              "group/swatch flex size-7 cursor-pointer items-center justify-center rounded-md outline-none",
              "transition-[background-color] duration-fast ease-out hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand",
            )}
          >
            <span
              style={{ backgroundColor: INK_HEX[item] }}
              className={cn(
                "size-3.5 rounded-full ring-1 ring-foreground/15 transition-[scale,box-shadow] duration-fast ease-out",
                color === item ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-popover" : "group-hover/swatch:scale-110",
              )}
            />
          </button>
        ))}
      </div>
      <ToolbarSeparator />
      <ToolbarButton tooltip="Undo" shortcut="Ctrl Z" disabled={!canUndo} onClick={onUndo}>
        <ArrowUUpLeft weight="bold" />
      </ToolbarButton>
      <ToolbarButton tooltip={count ? `Clear ${count} ${count === 1 ? "drawing" : "drawings"}` : "Nothing to clear"} disabled={!count} onClick={onClear}>
        <Broom weight="bold" />
      </ToolbarButton>
    </Toolbar>
  )
}
