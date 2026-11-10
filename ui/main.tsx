import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Toaster } from "@/components/ui/toast"

import { CanvasBoard } from "../src/client/canvas-board"
import type { CanvasState } from "../src/store"
import "./styles.css"

const API = "/__canvas/api"

async function boot() {
  const asked = new URLSearchParams(window.location.search).get("c")
  const response = await fetch(asked ? `${API}?c=${encodeURIComponent(asked)}` : API)
  const state = (await response.json()) as CanvasState
  if (!asked) window.history.replaceState(null, "", `?c=${state.name}`)
  document.title = `${state.title} · Koala POC Canvas`
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <CanvasBoard initial={state} apiBase={API} />
      <Toaster />
    </StrictMode>,
  )
}

boot()
