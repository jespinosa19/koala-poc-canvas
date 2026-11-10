import {
  INK_COLORS,
  INK_TOOLS,
  REQUEST_KINDS,
  VERDICTS,
  inkBounds,
  type CanvasInkColor,
  type CanvasInkTool,
  nextContext,
  resizeFrame,
  shortId,
  type CanvasCommentTarget,
  type CanvasRequestKind,
  type CanvasState,
  type CanvasVerdict,
} from "./model"

export type CanvasOp =
  | {
      op: "context"
      selected?: string | null
      focused?: string | null
      viewport?: { x: number; y: number; zoom: number }
      theme?: string | null
    }
  | {
      op: "comment.add"
      frameId: string
      x: number
      y: number
      width?: number
      height?: number
      scrollX?: number
      scrollY?: number
      text: string
      target?: CanvasCommentTarget
    }
  | { op: "comment.reply"; id: string; text: string }
  | { op: "comment.resolve"; id: string; resolved: boolean }
  | { op: "comment.delete"; id: string }
  | { op: "frame.resize"; id: string; width: number; height: number }
  | { op: "frame.verdict"; ids: string[]; verdict: CanvasVerdict | null }
  | { op: "request.add"; kind: CanvasRequestKind; frameIds: string[]; text?: string }
  | { op: "request.cancel"; id: string }
  | {
      op: "drawing.add"
      tool: CanvasInkTool
      color: CanvasInkColor
      size: number
      frameId: string | null
      points: [number, number][]
      scrollX?: number
      scrollY?: number
      target?: CanvasCommentTarget
    }
  | { op: "drawing.delete"; ids: string[] }
  | { op: "drawing.clear"; frameId?: string | null }

const MAX_POINTS = 4000

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

export function mutateCanvas(draft: CanvasState, body: CanvasOp, stamp: string): string | null {
  let created: string | null = null
  const frameOf = (id: string) => {
    const frame = draft.frames.find((item) => item.id === id)
    if (!frame) throw new Error(`No frame "${id}"`)
    return frame
  }
  switch (body.op) {
    case "context": {
      draft.context = nextContext(draft.context, body) ?? draft.context
      return created
    }
    case "comment.add": {
      const text = String(body.text ?? "").trim()
      if (!text) throw new Error("A comment needs text")
      frameOf(body.frameId)
      if (!finite(body.x) || !finite(body.y)) throw new Error("A comment needs x and y")
      created = shortId("c")
      const area =
        finite(body.width) && finite(body.height) && body.width >= 4 && body.height >= 4
          ? { width: Math.round(body.width), height: Math.round(body.height) }
          : {}
      draft.comments.push({
        id: created,
        frameId: body.frameId,
        x: Math.round(body.x),
        y: Math.round(body.y),
        ...area,
        scrollX: Math.round(body.scrollX ?? 0),
        scrollY: Math.round(body.scrollY ?? 0),
        text,
        author: "owner",
        target: body.target,
        resolved: false,
        replies: [],
        createdAt: stamp,
        updatedAt: stamp,
      })
      return created
    }
    case "comment.reply": {
      const comment = draft.comments.find((item) => item.id === body.id)
      if (!comment) throw new Error(`No comment "${body.id}"`)
      const text = String(body.text ?? "").trim()
      if (!text) throw new Error("A reply needs text")
      comment.replies.push({ id: shortId("r"), author: "owner", text, createdAt: stamp })
      comment.updatedAt = stamp
      return created
    }
    case "comment.resolve": {
      const comment = draft.comments.find((item) => item.id === body.id)
      if (!comment) throw new Error(`No comment "${body.id}"`)
      comment.resolved = Boolean(body.resolved)
      comment.updatedAt = stamp
      return created
    }
    case "comment.delete": {
      draft.comments = draft.comments.filter((item) => item.id !== body.id)
      return created
    }
    case "frame.resize": {
      resizeFrame(draft, body.id, body.width, body.height)
      return created
    }
    case "frame.verdict": {
      if (body.verdict !== null && !VERDICTS.includes(body.verdict)) throw new Error(`Unknown verdict "${body.verdict}"`)
      if (!Array.isArray(body.ids) || !body.ids.length) throw new Error("A verdict needs at least one frame")
      for (const id of body.ids) {
        const frame = frameOf(id)
        if (body.verdict) frame.verdict = body.verdict
        else delete frame.verdict
        frame.updatedAt = stamp
      }
      return created
    }
    case "request.add": {
      if (!REQUEST_KINDS.includes(body.kind)) throw new Error(`Unknown request "${body.kind}"`)
      const ids = [...new Set(Array.isArray(body.frameIds) ? body.frameIds : [])]
      ids.forEach(frameOf)
      if (body.kind === "mix" && ids.length < 2) throw new Error("A mix needs two frames or more")
      if (body.kind !== "mix" && ids.length !== 1) throw new Error(`"${body.kind}" works on one frame`)
      created = shortId("q")
      draft.requests ??= []
      draft.requests.push({
        id: created,
        kind: body.kind,
        frameIds: ids,
        text: String(body.text ?? "").trim(),
        status: "open",
        createdAt: stamp,
        updatedAt: stamp,
      })
      return created
    }
    case "request.cancel": {
      const request = draft.requests?.find((item) => item.id === body.id)
      if (!request) throw new Error(`No request "${body.id}"`)
      request.status = "cancelled"
      request.updatedAt = stamp
      return created
    }
    case "drawing.add": {
      if (!INK_TOOLS.includes(body.tool)) throw new Error(`Unknown ink tool "${body.tool}"`)
      if (!INK_COLORS.includes(body.color)) throw new Error(`Unknown ink colour "${body.color}"`)
      if (body.frameId !== null) frameOf(body.frameId)
      const points = (Array.isArray(body.points) ? body.points : [])
        .filter((point) => Array.isArray(point) && finite(point[0]) && finite(point[1]))
        .slice(0, MAX_POINTS)
        .map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number])
      const shape = body.tool === "pen" || body.tool === "marker" ? 1 : 2
      if (points.length < shape) throw new Error("A drawing needs points")
      const size = finite(body.size) ? Math.min(400, Math.max(0.5, Math.round(body.size * 10) / 10)) : 4
      const kept = shape === 2 ? [points[0], points[points.length - 1]] : points
      created = shortId("d")
      draft.drawings ??= []
      draft.drawings.push({
        id: created,
        tool: body.tool,
        color: body.color,
        size,
        frameId: body.frameId,
        points: kept,
        scrollX: Math.round(body.scrollX ?? 0),
        scrollY: Math.round(body.scrollY ?? 0),
        bounds: inkBounds(kept, size),
        target: body.target,
        author: "owner",
        createdAt: stamp,
      })
      return created
    }
    case "drawing.delete": {
      const ids = new Set(Array.isArray(body.ids) ? body.ids : [])
      draft.drawings = (draft.drawings ?? []).filter((item) => !ids.has(item.id))
      return created
    }
    case "drawing.clear": {
      draft.drawings =
        body.frameId === undefined ? [] : (draft.drawings ?? []).filter((item) => item.frameId !== body.frameId)
      return created
    }
    default:
      throw new Error("Unknown op")
  }
}
