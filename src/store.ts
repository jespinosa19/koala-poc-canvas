import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

import { now, openRequests, type CanvasState } from "./model"

export * from "./model"

export const CANVAS_DIR_NAME = ".koala-canvas"
export const DEFAULT_CANVAS = "main"

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

export function canvasRoot(cwd: string = process.cwd()) {
  return path.join(cwd, CANVAS_DIR_NAME)
}

export function isCanvasName(name: unknown): name is string {
  return typeof name === "string" && NAME_PATTERN.test(name)
}

export function canvasFile(name: string, cwd?: string) {
  if (!isCanvasName(name)) throw new Error(`Invalid canvas name "${name}": use lowercase letters, digits and dashes.`)
  return path.join(canvasRoot(cwd), `${name}.json`)
}

export function canvasExists(name: string, cwd?: string) {
  return existsSync(canvasFile(name, cwd))
}

export function readCanvas(name: string, cwd?: string): CanvasState | null {
  const file = canvasFile(name, cwd)
  if (!existsSync(file)) return null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as CanvasState
    } catch (error) {
      if (attempt === 4) throw error
    }
  }
  return null
}

export function writeCanvas(state: CanvasState, cwd?: string) {
  const file = canvasFile(state.name, cwd)
  mkdirSync(path.dirname(file), { recursive: true })
  const next: CanvasState = { ...state, rev: state.rev + 1, updatedAt: now() }
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`)
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(temp, file)
      break
    } catch (error) {
      if (attempt >= 10) throw error
      const until = Date.now() + 20
      while (Date.now() < until) {}
    }
  }
  return next
}

export function updateCanvas(name: string, change: (state: CanvasState) => CanvasState | void, cwd?: string) {
  const current = readCanvas(name, cwd)
  if (!current) throw new Error(`Canvas "${name}" does not exist. Run: node scripts/canvas.mjs init ${name}`)
  const draft = structuredClone(current)
  const result = change(draft) ?? draft
  return writeCanvas(result, cwd)
}

export function listCanvases(cwd?: string) {
  const root = canvasRoot(cwd)
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -5))
    .filter(isCanvasName)
    .map((name) => {
      const state = readCanvas(name, cwd)
      return {
        name,
        title: state?.title ?? name,
        frames: state?.frames.length ?? 0,
        openComments: state?.comments.filter((comment) => !comment.resolved).length ?? 0,
        openRequests: state ? openRequests(state).length : 0,
        updatedAt: state?.updatedAt ?? statSync(canvasFile(name, cwd)).mtime.toISOString(),
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
