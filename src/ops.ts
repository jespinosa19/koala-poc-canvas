import { now, readCanvas, nextContext, updateCanvas } from "./store"
import { mutateCanvas, type CanvasOp } from "./ops-core"

export type { CanvasOp }

export function applyCanvasOp(name: string, body: CanvasOp, cwd?: string) {
  const stamp = now()
  let created: string | null = null
  if (body.op === "context") {
    const current = readCanvas(name, cwd)
    if (current && !nextContext(current.context, body)) return { rev: current.rev, id: null, unchanged: true }
  }
  const state = updateCanvas(
    name,
    (draft) => {
      created = mutateCanvas(draft, body, stamp)
    },
    cwd,
  )
  return { rev: state.rev, id: created }
}
