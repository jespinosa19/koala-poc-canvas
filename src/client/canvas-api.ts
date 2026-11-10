"use client"

import type { CanvasOp } from "../ops"
import type { CanvasCommentTarget } from "../store"

export type { CanvasOp }

export async function sendOp(apiBase: string, canvas: string, op: CanvasOp) {
  const response = await fetch(`${apiBase}?c=${encodeURIComponent(canvas)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(op),
  })
  const body = (await response.json()) as { ok?: boolean; error?: string; id?: string | null }
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`)
  return body
}

export function describeTarget(doc: Document, x: number, y: number): CanvasCommentTarget | undefined {
  const hit = doc.elementFromPoint(x, y) as HTMLElement | null
  if (!hit || hit === doc.documentElement || hit === doc.body) return undefined
  const parts: string[] = []
  let node: HTMLElement | null = hit
  while (node && node !== doc.body && parts.length < 5) {
    let part = node.tagName.toLowerCase()
    const slot = node.getAttribute("data-slot")
    if (node.id) part += `#${node.id}`
    else if (slot) part += `[data-slot="${slot}"]`
    parts.unshift(part)
    if (node.id) break
    node = node.parentElement
  }
  const text = (hit.innerText || hit.textContent || "").replace(/\s+/g, " ").trim().slice(0, 140)
  return { selector: parts.join(" > "), text }
}
