import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Toaster } from "@/components/ui/toast"

import { fitCamera, layoutFrames } from "../src/client/camera"
import { CanvasBoard } from "../src/client/canvas-board"
import { nextContext, now } from "../src/model"
import { mutateCanvas, type CanvasOp } from "../src/ops-core"
import type { CanvasState } from "../src/model"
import "./styles.css"

const API = "/__canvas/api"
const params = new URLSearchParams(window.location.search)
const name = params.get("c") ?? ""
const view = params.get("view") ?? "all"

let state: CanvasState | null = null
const listeners = new Set<FakeEventSource>()

function broadcast() {
  const data = JSON.stringify(state)
  for (const listener of listeners) listener.onmessage?.({ data } as MessageEvent)
}

class FakeEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  readyState = 1
  constructor() {
    listeners.add(this)
    queueMicrotask(() => {
      this.onopen?.(new Event("open"))
      if (state) this.onmessage?.({ data: JSON.stringify(state) } as MessageEvent)
    })
  }
  close() {
    this.readyState = 2
    listeners.delete(this)
  }
  addEventListener() {}
  removeEventListener() {}
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href)
  if (!url.pathname.startsWith(API) || !state) return realFetch(input, init)
  if ((init?.method ?? "GET").toUpperCase() !== "POST") return json(state)
  try {
    const body = JSON.parse(String(init?.body ?? "{}")) as CanvasOp
    if (body.op === "context") {
      const context = nextContext(state.context, body)
      if (context) state = { ...state, context }
      return json({ ok: true, rev: state.rev, id: null })
    }
    const draft = structuredClone(state)
    const id = mutateCanvas(draft, body, now())
    state = { ...draft, rev: draft.rev + 1, updatedAt: now() }
    queueMicrotask(broadcast)
    return json({ ok: true, rev: state.rev, id })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400)
  }
}
;(window as unknown as { EventSource: unknown }).EventSource = FakeEventSource

function placeCamera(canvas: CanvasState) {
  const key = `koala-canvas:${canvas.name}:camera`
  try {
    if (view !== "lead") return localStorage.removeItem(key)
    const { frames, rows } = layoutFrames(canvas.frames)
    const lead = frames.filter((frame) => frame.row === rows[0]?.row).slice(0, 2)
    if (!lead.length) return localStorage.removeItem(key)
    const box = {
      x: 0,
      y: 0,
      width: Math.max(...lead.map((frame) => frame.left + frame.width)),
      height: Math.max(...lead.map((frame) => frame.top + frame.height)),
    }
    const camera = fitCamera(box, { width: window.innerWidth, height: window.innerHeight }, { top: 152, bottom: 88, left: 48, right: 48 }, 1)
    localStorage.setItem(key, JSON.stringify(camera))
  } catch {}
}

async function boot() {
  const response = await realFetch(`./canvases/${encodeURIComponent(name)}.json`)
  if (!response.ok) {
    document.getElementById("root")!.textContent = "Canvas not found"
    return
  }
  state = (await response.json()) as CanvasState
  document.title = `${state.title} · Koala POC Canvas`
  placeCamera(state)
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <CanvasBoard initial={state} apiBase={API} />
      <Toaster />
    </StrictMode>,
  )
}

boot()
