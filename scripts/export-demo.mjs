import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at === -1 ? fallback : args[at + 1]
}
const source = flag("from", ".koala-canvas")
const out = flag("out", "dist-demo/canvases")
const images = flag("images")
const names = (flag("canvases", "") || "").split(",").filter(Boolean)
const drop = new Set((flag("drop-comments", "") || "").split(",").filter(Boolean))
const scale = Number(flag("scale", "1.5"))
const translations = flag("translate") ? JSON.parse(readFileSync(flag("translate"), "utf8")) : {}

if (!images || !names.length) {
  process.stderr.write("Usage: node scripts/export-demo.mjs --images <base url> --canvases a,b [--from .koala-canvas] [--out dist-demo/canvases] [--drop-comments id,id]\n")
  process.exit(1)
}

const withWidth = (url, width) => `${url}${url.includes("?") ? "&" : "?"}tr=w-${width},f-auto`

mkdirSync(out, { recursive: true })
for (const name of names) {
  const state = JSON.parse(readFileSync(join(source, `${name}.json`), "utf8"))
  state.frames = state.frames.map((frame) => {
    const still = withWidth(`${images.replace(/\/+$/, "")}/${name}/${frame.id}`, Math.round(frame.width * scale))
    if (frame.kind === "image") return { ...frame, src: still }
    return { ...frame, src: `frame.html?src=${encodeURIComponent(still)}&title=${encodeURIComponent(frame.title)}` }
  })
  state.comments = state.comments.filter((comment) => !drop.has(comment.id))
  const t = translations[name] ?? {}
  const row = (value) => t.rows?.[value] ?? value
  if (t.title) state.title = t.title
  state.frames = state.frames.map((frame) => {
    const title = t.frames?.[frame.id] ?? frame.title
    const src = frame.kind === "image" ? frame.src : frame.src.replace(/&title=[^&]*/, `&title=${encodeURIComponent(title)}`)
    return { ...frame, title, row: row(frame.row), src }
  })
  state.decisions = (state.decisions ?? []).map((decision) => ({
    ...decision,
    why: t.decisions?.[decision.row] ?? decision.why,
    row: row(decision.row),
  }))
  state.comments = state.comments.map((comment) => ({
    ...comment,
    text: t.comments?.[comment.id] ?? comment.text,
    replies: comment.replies.map((reply) => ({ ...reply, text: t.replies?.[reply.id] ?? reply.text })),
  }))
  state.context = { selected: null, focused: null, viewport: null, updatedAt: null }
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state))
  process.stdout.write(`${JSON.stringify({ name, frames: state.frames.length, comments: state.comments.length })}\n`)
}
