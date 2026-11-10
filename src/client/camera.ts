import type { CanvasFrame } from "../store"

export interface Camera {
  x: number
  y: number
  z: number
}

export interface PlacedFrame extends CanvasFrame {
  left: number
  top: number
}

export interface PlacedRow {
  row: string
  left: number
  top: number
}

export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 4
export const COL_GAP = 160
export const ROW_GAP = 360

export { clampFrameSize } from "../frame-size.mjs"

export const SNAP_WIDTHS = [320, 375, 390, 430, 640, 768, 820, 1024, 1280, 1440, 1536, 1920]

const BREAKPOINTS = [
  { name: "2xl", min: 1536 },
  { name: "xl", min: 1280 },
  { name: "lg", min: 1024 },
  { name: "md", min: 768 },
  { name: "sm", min: 640 },
]

export function snapWidth(width: number, tolerance: number) {
  let best = width
  let distance = tolerance
  for (const candidate of SNAP_WIDTHS) {
    const gap = Math.abs(candidate - width)
    if (gap <= distance) {
      best = candidate
      distance = gap
    }
  }
  return best
}

export function breakpointOf(width: number) {
  return BREAKPOINTS.find((breakpoint) => width >= breakpoint.min)?.name ?? "base"
}

export const clampZoom =(z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

export function layoutFrames(frames: CanvasFrame[]) {
  const order: string[] = []
  const byRow = new Map<string, CanvasFrame[]>()
  for (const frame of frames) {
    if (!byRow.has(frame.row)) {
      byRow.set(frame.row, [])
      order.push(frame.row)
    }
    byRow.get(frame.row)!.push(frame)
  }
  const placed: PlacedFrame[] = []
  const rows: PlacedRow[] = []
  let top = 0
  for (const row of order) {
    const items = byRow.get(row)!
    rows.push({ row, left: 0, top })
    let left = 0
    let tallest = 0
    for (const frame of items) {
      placed.push({ ...frame, left, top })
      left += frame.width + COL_GAP
      tallest = Math.max(tallest, frame.height)
    }
    top += tallest + ROW_GAP
  }
  return { frames: placed, rows }
}

export function boundsOf(frames: PlacedFrame[]) {
  if (!frames.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const frame of frames) {
    minX = Math.min(minX, frame.left)
    minY = Math.min(minY, frame.top)
    maxX = Math.max(maxX, frame.left + frame.width)
    maxY = Math.max(maxY, frame.top + frame.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export interface Inset {
  top: number
  right: number
  bottom: number
  left: number
}

export function fitCamera(
  box: { x: number; y: number; width: number; height: number },
  view: { width: number; height: number },
  inset: Inset,
  maxZoom = 1,
): Camera {
  const width = Math.max(1, view.width - inset.left - inset.right)
  const height = Math.max(1, view.height - inset.top - inset.bottom)
  const z = clampZoom(Math.min(width / box.width, height / box.height, maxZoom))
  return {
    z,
    x: inset.left + (width - box.width * z) / 2 - box.x * z,
    y: inset.top + (height - box.height * z) / 2 - box.y * z,
  }
}

export function wheelDelta(event: WheelEvent, pageHeight: number) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1
  return { dx: event.deltaX * unit, dy: event.deltaY * unit }
}

export function zoomFactor(dy: number) {
  const step = Math.max(-100, Math.min(100, dy))
  const rate = Math.abs(step) < 40 ? 0.01 : 0.0014
  return Math.exp(-step * rate)
}

export function gridStep(z: number) {
  let step = 24 * z
  while (step < 12) step *= 2
  while (step > 48) step /= 2
  return step
}
