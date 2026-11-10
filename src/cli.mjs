import { spawn } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, extname, join, resolve } from "node:path"
import { parseArgs } from "node:util"

import {
  CANVAS_DIR_NAME,
  DEFAULT_CANVAS,
  canvasExists,
  VERDICTS,
  canvasRoot,
  decisionFor,
  emptyCanvas,
  insertAfterFamily,
  isCanvasName,
  listCanvases,
  now,
  openRequests,
  readCanvas,
  rowsOf,
  shortId,
  slugify,
  uniqueId,
  updateCanvas,
  writeCanvas,
} from "./store.ts"

let ROOT = process.cwd()
let ORIGIN = "http://localhost:3000"
let PAGE = "/lab/canvas"
let ASSET_BASE = "/api/canvas/asset"
let CMD = "koala-poc-canvas"
let CHROME = null

const chromeCandidates = () => {
  if (process.env.CHROME_PATH) return [process.env.CHROME_PATH]
  if (process.platform === "win32")
    return [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ]
  if (process.platform === "darwin")
    return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"]
  const dirs = (process.env.PATH ?? "").split(":")
  return ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].flatMap((bin) => dirs.map((dir) => join(dir, bin)))
}

const findChrome = () => chromeCandidates().find((candidate) => existsSync(candidate)) ?? null
const DEVICES = {
  desktop: [1440, 900],
  laptop: [1280, 800],
  tablet: [820, 1180],
  mobile: [390, 844],
}

const help = () => `Koala POC Canvas: lay out live design variants side by side and read the owner's comments.

Usage: ${CMD} <command> [options]     (all output is JSON)

  init [name] [--title T]                  create a canvas and make it current
  use <name>                               make an existing canvas current
  add --route /lab/x?v=b --title T         add a live frame (also --url <http..> or --image <file.png>)
      [--width 1440 --height 900 | --device desktop|laptop|tablet|mobile] [--row R] [--id ID] [--note N]
      [--from F]                           a variation of frame F: sits right after it, same row and size
  update <frame> [--title --route --url --width --height --device --row --note]
  remove <frame>
  list [--all]                             frames of the current canvas (--all: every canvas)
  context                                  what the owner has selected or focused right now
  comments [--all] [--frame F]             open comments (--all includes resolved)
  comments reply <comment> "text"          answer a comment as the agent
  comments resolve <comment> [--note N]    mark a comment done, optionally saying what changed
  comments reopen <comment>
  drawings [--frame F] [--points]          what the owner drew on the canvas (pen, marker, arrows, boxes)
  drawings remove <drawing...>             take drawings off once you acted on them
  drawings clear [--frame F]
  screenshot <frame> [--full] [--pins] [--theme light|dark] [--out file.png]
                                           --pins draws open comments and the owner's drawings on it
  check --route /lab/x?v=b [--device D | --width W --height H] [--full] [--theme T]
                                           render a route WITHOUT adding it: status, console errors and
                                           a screenshot, so a variant can be reviewed before the canvas

  verdict <frame> pick|maybe|out|none      mark a frame (the owner does this on the canvas)
  requests [--all]                         what the owner asked for: more (variations), mix, decide
  requests done <request> [--frames a,b] [--note N]   answered, with the frames you made
  requests cancel <request>
  decide <row|frame> --why "..." [--winner F] [--keep]  record the decision for a row; freezes the
                                           other frames into images (--keep leaves them live)
  decisions                                every decision on this canvas
  thaw <frame>                             a frozen frame goes live again
  open                                     the canvas URL for the browser
${CMD === "koala-poc-canvas" ? `
  serve [--target http://localhost:5173] [--port 4848] [--host 127.0.0.1]
                                           run the canvas for this folder; routes are proxied from --target
  skill [--project]                        install the agent skill and its three agents in ~/.claude
                                           (or this project's .claude)

The old command name, koala-canvas, still works as an alias.
` : ""}
Options: --canvas <name> (or -c) picks a canvas other than the current one.
State: .koala-canvas/ at the project root.
Env: KOALA_CANVAS_ORIGIN (where routes are served, now ${ORIGIN}), KOALA_CANVAS_PORT, CHROME_PATH.`

const out = (value) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

const fail = (message, extra = {}) => {
  out({ ok: false, error: message, ...extra })
  process.exit(1)
}

const OPTIONS = {
    canvas: { type: "string", short: "c" },
    title: { type: "string" },
    route: { type: "string" },
    url: { type: "string" },
    image: { type: "string" },
    width: { type: "string" },
    height: { type: "string" },
    device: { type: "string" },
    row: { type: "string" },
    id: { type: "string" },
    note: { type: "string" },
    from: { type: "string" },
    frames: { type: "string" },
    winner: { type: "string" },
    why: { type: "string" },
    keep: { type: "boolean" },
    frame: { type: "string" },
    theme: { type: "string" },
    out: { type: "string" },
    all: { type: "boolean" },
    full: { type: "boolean" },
    pins: { type: "boolean" },
    points: { type: "boolean" },
    help: { type: "boolean", short: "h" },
    port: { type: "string" },
    host: { type: "string" },
    target: { type: "string" },
    dir: { type: "string" },
}

let opts = {}
let command
let rest = []
let currentFile = ""

export function parse(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: false, options: OPTIONS })
  return { opts: values, positionals }
}

const currentName = () => {
  if (typeof opts.canvas === "string") return opts.canvas
  if (existsSync(currentFile)) {
    const saved = readFileSync(currentFile, "utf8").trim()
    if (isCanvasName(saved)) return saved
  }
  return DEFAULT_CANVAS
}

const setCurrent = (name) => {
  mkdirSync(canvasRoot(ROOT), { recursive: true })
  writeFileSync(currentFile, `${name}\n`)
}

const canvasUrl = (name) => `${ORIGIN}${PAGE}?c=${name}`

const load = (name = currentName()) => {
  const state = readCanvas(name, ROOT)
  if (!state) fail(`Canvas "${name}" does not exist. Run: ${CMD} init ${name}`)
  return state
}

const toInt = (value, label) => {
  if (value === undefined) return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || number < 120 || number > 8000) fail(`${label} must be a number of pixels between 120 and 8000`)
  return Math.round(number)
}

const size = (fallback) => {
  let [width, height] = fallback
  if (opts.device) {
    const preset = DEVICES[opts.device]
    if (!preset) fail(`Unknown device "${opts.device}". Use one of: ${Object.keys(DEVICES).join(", ")}`)
    ;[width, height] = preset
  }
  return [toInt(opts.width, "--width") ?? width, toInt(opts.height, "--height") ?? height]
}

const source = (name) => {
  const given = ["route", "url", "image"].filter((key) => typeof opts[key] === "string")
  if (given.length > 1) fail("Pass only one of --route, --url or --image")
  if (!given.length) return null
  const kind = given[0]
  const value = opts[kind]
  if (kind === "route") {
    const mangled = value.match(/^[A-Za-z]:[\\/].*?[\\/]Git[\\/](.*)$/)
    if (mangled) return { kind, src: `/${mangled[1].replace(/\\/g, "/")}` }
    if (!value.startsWith("/")) fail(`--route must start with "/", e.g. /lab/pricing-variants?v=b`)
    return { kind, src: value }
  }
  if (kind === "url") {
    if (!/^https?:\/\//.test(value)) fail("--url must be an http(s) URL")
    return { kind, src: value }
  }
  const file = resolve(value)
  if (!existsSync(file)) fail(`No such image: ${file}`)
  const ext = extname(file).toLowerCase()
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) fail("--image must be png, jpg, webp, gif or svg")
  const assets = join(canvasRoot(ROOT), "assets")
  mkdirSync(assets, { recursive: true })
  const stored = `${name}-${shortId("img")}${ext}`
  copyFileSync(file, join(assets, stored))
  return { kind, src: `${ASSET_BASE}/${stored}` }
}

const probe = async (frame) => {
  if (frame.kind === "image") return { reachable: true }
  const target = frame.kind === "route" ? ORIGIN + frame.src : frame.src
  try {
    const response = await fetch(target, { method: "GET", signal: AbortSignal.timeout(60000) })
    return { reachable: response.ok, status: response.status }
  } catch (error) {
    return { reachable: false, error: `Could not reach ${target}: ${error.cause?.code ?? error.message}` }
  }
}

const frameView = (frame, state) => ({
  ...frame,
  openComments: state.comments.filter((comment) => comment.frameId === frame.id && !comment.resolved).length,
  openRequests: openRequests(state).filter((request) => request.frameIds.includes(frame.id)).length,
  liveUrl: frame.kind === "route" ? ORIGIN + frame.src : frame.kind === "image" ? ORIGIN + frame.src : frame.src,
})

const commentView = (comment, state) => {
  const frame = state.frames.find((item) => item.id === comment.frameId)
  return {
    ...comment,
    kind: comment.width && comment.height ? "area" : "point",
    ...(comment.width && comment.height
      ? { area: { x: comment.x, y: comment.y, width: comment.width, height: comment.height } }
      : {}),
    frame: frame ? { id: frame.id, title: frame.title, src: frame.src, width: frame.width, height: frame.height } : null,
  }
}

const INK_HEX = { lime: "#a3e635", red: "#f43f5e", amber: "#f59e0b", blue: "#3b82f6", white: "#ffffff" }

const INK_NOUN = { pen: "pen stroke", marker: "marker highlight", arrow: "arrow", rect: "box", ellipse: "circle" }

const drawingView = (drawing, state, withPoints = false) => {
  const frame = drawing.frameId ? state.frames.find((item) => item.id === drawing.frameId) : null
  const { points, ...rest } = drawing
  const b = drawing.bounds
  const where = frame ? `on "${frame.title}"` : "on the canvas, outside any frame"
  const at =
    drawing.tool === "arrow"
      ? `from (${Math.round(points[0][0])}, ${Math.round(points[0][1])}) to (${Math.round(points[1][0])}, ${Math.round(points[1][1])})`
      : `around x ${b.x}..${b.x + b.width}, y ${b.y}..${b.y + b.height}`
  const on = drawing.target?.text ? `, ${drawing.tool === "arrow" ? "pointing at" : "over"} "${drawing.target.text.slice(0, 60)}"` : ""
  const near = frame
    ? state.comments
        .filter((comment) => comment.frameId === frame.id && !comment.resolved)
        .filter((comment) => {
          const cx = comment.x + comment.scrollX - drawing.scrollX
          const cy = comment.y + comment.scrollY - drawing.scrollY
          const m = 80
          return cx >= b.x - m && cx <= b.x + b.width + m && cy >= b.y - m && cy <= b.y + b.height + m
        })
        .map((comment) => comment.id)
    : []
  return {
    ...rest,
    describe: `${drawing.color} ${INK_NOUN[drawing.tool]} ${where} ${at}${on}`,
    frame: frame ? { id: frame.id, title: frame.title, src: frame.src, width: frame.width, height: frame.height } : null,
    nearComments: near,
    ...(withPoints ? { points } : { pointCount: points.length }),
  }
}

const inkOverlayScript = (drawings) => `(() => {
  const NS = "http://www.w3.org/2000/svg"
  const hex = ${JSON.stringify(INK_HEX)}
  const svg = document.createElementNS(NS, "svg")
  const w = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
  svg.setAttribute("width", w); svg.setAttribute("height", h)
  svg.style.cssText = "position:absolute;left:0;top:0;z-index:2147483645;pointer-events:none;overflow:visible"
  for (const d of ${JSON.stringify(drawings)}) {
    const pts = d.points.map(([x, y]) => [x + d.scrollX, y + d.scrollY])
    const color = hex[d.color] || "#a3e635"
    let el
    if (d.tool === "rect") {
      el = document.createElementNS(NS, "rect")
      const [a, b] = pts
      el.setAttribute("x", Math.min(a[0], b[0])); el.setAttribute("y", Math.min(a[1], b[1]))
      el.setAttribute("width", Math.abs(b[0] - a[0])); el.setAttribute("height", Math.abs(b[1] - a[1]))
      el.setAttribute("rx", 6)
    } else if (d.tool === "ellipse") {
      el = document.createElementNS(NS, "ellipse")
      const [a, b] = pts
      el.setAttribute("cx", (a[0] + b[0]) / 2); el.setAttribute("cy", (a[1] + b[1]) / 2)
      el.setAttribute("rx", Math.abs(b[0] - a[0]) / 2); el.setAttribute("ry", Math.abs(b[1] - a[1]) / 2)
    } else if (d.tool === "arrow") {
      el = document.createElementNS(NS, "path")
      const [a, b] = pts
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
      const head = Math.max(12, d.size * 4)
      const l = [b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45)]
      const r = [b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45)]
      el.setAttribute("d", "M" + a + "L" + b + "M" + l + "L" + b + "L" + r)
    } else {
      el = document.createElementNS(NS, "path")
      el.setAttribute("d", pts.length === 1 ? "M" + pts[0] + "l0.01 0" : "M" + pts.map((p) => p.join(" ")).join("L"))
      if (d.tool === "marker") el.setAttribute("stroke-opacity", "0.4")
    }
    el.setAttribute("fill", "none"); el.setAttribute("stroke", color)
    el.setAttribute("stroke-width", d.size); el.setAttribute("stroke-linecap", "round"); el.setAttribute("stroke-linejoin", "round")
    svg.appendChild(el)
  }
  document.body.appendChild(svg)
  return true
})()`

const findFrame = (state, id) => {
  const frame = state.frames.find((item) => item.id === id)
  if (!frame) fail(`No frame "${id}" on canvas "${state.name}"`, { frames: state.frames.map((item) => item.id) })
  return frame
}

const requestView = (request, state) => ({
  ...request,
  frames: request.frameIds.map((id) => {
    const frame = state.frames.find((item) => item.id === id)
    return frame
      ? { id: frame.id, title: frame.title, src: frame.frozen?.src ?? frame.src, row: frame.row, verdict: frame.verdict ?? null }
      : { id, missing: true }
  }),
})

const decisionView = (decision, state) => {
  const title = (id) => state.frames.find((item) => item.id === id)?.title ?? id
  return { ...decision, winnerTitle: decision.winner ? title(decision.winner) : null, otherTitles: decision.others.map(title) }
}

const findComment = (state, id) => {
  const comment = state.comments.find((item) => item.id === id)
  if (!comment) fail(`No comment "${id}" on canvas "${state.name}"`)
  return comment
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function screenshot(state, frame, o = opts) {
  const shots = join(canvasRoot(ROOT), "shots")
  mkdirSync(shots, { recursive: true })
  const file = resolve(typeof o.out === "string" ? o.out : join(shots, `${state.name}--${frame.id}.png`))

  if (frame.kind === "image" && !o.pins) {
    const stored = join(canvasRoot(ROOT), "assets", frame.src.split("/").pop())
    copyFileSync(stored, file)
    return { file, width: frame.width, height: frame.height }
  }
  CHROME = findChrome()
  if (!CHROME) fail("Chrome or Chromium not found. Install it or set CHROME_PATH.")

  const url = frame.kind === "url" ? frame.src : ORIGIN + frame.src
  const port = 9400 + Math.floor(Math.random() * 400)
  const profile = mkdtempSync(join(tmpdir(), "koala-poc-canvas-"))
  const chrome = spawn(CHROME, [
    "--headless=new",
    ...(process.platform === "linux" ? ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] : []),
    `--remote-debugging-port=${port}`,
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    "about:blank",
  ])
  try {
    let ready = false
    for (let i = 0; i < 60 && !ready; i++) {
      try {
        ready = (await fetch(`http://localhost:${port}/json/version`)).ok
      } catch {
        await sleep(200)
      }
    }
    if (!ready) throw new Error("Chrome did not open its debugging port")
    const target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: "PUT" })).json()
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((done, reject) => {
      ws.addEventListener("open", done, { once: true })
      ws.addEventListener("error", reject, { once: true })
    })
    let nextId = 0
    const pending = new Map()
    const errors = []
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data))
      if (errors.length < 20) {
        if (message.method === "Runtime.exceptionThrown") {
          const detail = message.params?.exceptionDetails
          errors.push(String(detail?.exception?.description ?? detail?.text ?? "Uncaught exception").split("\n")[0])
        } else if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
          errors.push(`console.error: ${(message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" ").slice(0, 300)}`)
        } else if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
          errors.push(`${message.params.entry.source}: ${String(message.params.entry.text).slice(0, 300)}`)
        }
      }
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message)
        pending.delete(message.id)
      }
    })
    const send = (method, params = {}) =>
      new Promise((done) => {
        const id = ++nextId
        pending.set(id, done)
        ws.send(JSON.stringify({ id, method, params }))
      })
    const evaluate = async (expression) => {
      const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
      return response.result?.result?.value
    }

    await send("Page.enable")
    await send("Runtime.enable")
    await send("Log.enable")
    await send("Emulation.setDeviceMetricsOverride", {
      width: frame.width,
      height: frame.height,
      deviceScaleFactor: 1,
      mobile: frame.width < 640,
    })
    const theme = typeof o.theme === "string" ? o.theme : "light"
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: theme === "light" || theme === "cream" ? "light" : "dark" }],
    })
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try{localStorage.setItem("theme", ${JSON.stringify(theme)})}catch(e){}`,
    })
    await send("Page.navigate", { url })
    const started = Date.now()
    let settled = false
    while (Date.now() - started < 90000) {
      await sleep(400)
      settled = await evaluate(`document.readyState === "complete" && (
        !document.querySelector("#__next, body > div") ||
        [...document.querySelectorAll("body *")].slice(0, 80).some((el) => Object.keys(el).some((key) => key.startsWith("__react")))
      )`)
      if (settled) break
    }
    await evaluate(`document.fonts ? document.fonts.ready.then(() => true) : true`)
    await sleep(900)

    if (o.pins) {
      const pins = state.comments
        .filter((comment) => comment.frameId === frame.id && (o.all || !comment.resolved))
        .map((comment) => ({
          n: state.comments.indexOf(comment) + 1,
          x: comment.x + comment.scrollX,
          y: comment.y + comment.scrollY,
          w: comment.width ?? 0,
          h: comment.height ?? 0,
        }))
      const ink = (state.drawings ?? []).filter((drawing) => drawing.frameId === frame.id)
      if (ink.length) await evaluate(inkOverlayScript(ink))
      await evaluate(`(() => {
        for (const pin of ${JSON.stringify(pins)}) {
          if (pin.w && pin.h) {
            const box = document.createElement("div")
            box.style.cssText = "position:absolute;z-index:2147483646;left:" + pin.x + "px;top:" + pin.y + "px;width:" + pin.w + "px;height:" + pin.h + "px;border:2px dashed #65a30d;background:rgba(163,230,53,0.12);box-shadow:0 0 0 2px #1a2e05;pointer-events:none"
            document.body.appendChild(box)
          }
          const el = document.createElement("div")
          el.textContent = String(pin.n)
          el.style.cssText = "position:absolute;z-index:2147483647;left:" + (pin.x - 14) + "px;top:" + (pin.y - 14) + "px;width:28px;height:28px;border-radius:50%;background:#a3e635;color:#1a2e05;font:600 12px/28px ui-monospace,monospace;text-align:center;box-shadow:0 0 0 2px #1a2e05,0 4px 10px rgba(0,0,0,0.25)"
          document.body.appendChild(el)
        }
        return true
      })()`)
    }

    let clip
    if (o.full) {
      const height = await evaluate(`Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)`)
      clip = { x: 0, y: 0, width: frame.width, height: Math.min(height ?? frame.height, 16000), scale: 1 }
    }
    const { result } = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: Boolean(o.full),
      ...(clip ? { clip } : {}),
    })
    if (!result?.data) throw new Error("Chrome returned no image")
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(result.data, "base64"))
    ws.close()
    return { file, url, width: frame.width, height: clip?.height ?? frame.height, hydrated: Boolean(settled), errors }
  } finally {
    chrome.kill()
    await sleep(300)
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {}
  }
}

async function main() {
  if (!command || opts.help || command === "help") {
    process.stdout.write(`${help()}\n`)
    return
  }

  switch (command) {
    case "init": {
      const name = rest[0] ?? (typeof opts.canvas === "string" ? opts.canvas : DEFAULT_CANVAS)
      if (!isCanvasName(name)) fail(`Invalid canvas name "${name}": use lowercase letters, digits and dashes`)
      const existed = canvasExists(name, ROOT)
      let state = readCanvas(name, ROOT)
      if (!state) state = writeCanvas(emptyCanvas(name, opts.title), ROOT)
      else if (opts.title) state = updateCanvas(name, (draft) => void (draft.title = opts.title), ROOT)
      setCurrent(name)
      out({ ok: true, created: !existed, canvas: name, title: state.title, url: canvasUrl(name), dir: CANVAS_DIR_NAME })
      return
    }

    case "use": {
      const name = rest[0]
      if (!isCanvasName(name) || !canvasExists(name, ROOT)) fail(`No canvas "${name}"`, { canvases: listCanvases(ROOT) })
      setCurrent(name)
      out({ ok: true, canvas: name, url: canvasUrl(name) })
      return
    }

    case "add": {
      const state = load()
      const from = source(state.name)
      if (!from) fail("add needs --route, --url or --image")
      if (!opts.title) fail("add needs --title")
      const parent = typeof opts.from === "string" ? findFrame(state, opts.from) : null
      const [width, height] = size(parent ? [parent.width, parent.height] : from.kind === "image" ? [1440, 900] : DEVICES.desktop)
      const id = opts.id ? slugify(opts.id) : uniqueId(opts.title, state.frames.map((frame) => frame.id))
      if (state.frames.some((frame) => frame.id === id)) fail(`A frame "${id}" already exists. Use update, or another --id.`)
      const stamp = now()
      const frame = {
        id,
        title: opts.title,
        kind: from.kind,
        src: from.src,
        width,
        height,
        row: opts.row ?? parent?.row ?? state.frames.at(-1)?.row ?? "Frames",
        ...(opts.note ? { note: opts.note } : {}),
        ...(parent ? { from: parent.id } : {}),
        createdAt: stamp,
        updatedAt: stamp,
      }
      const next = updateCanvas(
        state.name,
        (draft) => {
          if (parent && !opts.row) draft.frames = insertAfterFamily(draft.frames, frame, parent.id)
          else draft.frames.push(frame)
        },
        ROOT,
      )
      out({ ok: true, canvas: next.name, frame: frameView(frame, next), check: await probe(frame), url: canvasUrl(next.name) })
      return
    }

    case "update": {
      const state = load()
      const id = rest[0]
      if (!id) fail("update needs a frame id")
      const frame = findFrame(state, id)
      const from = source(state.name)
      const [width, height] = size([frame.width, frame.height])
      let updated
      const next = updateCanvas(
        state.name,
        (draft) => {
          const target = draft.frames.find((item) => item.id === id)
          if (opts.title) target.title = opts.title
          if (from) Object.assign(target, from)
          target.width = width
          target.height = height
          if (opts.width || opts.height || opts.device) {
            delete target.originalWidth
            delete target.originalHeight
          }
          if (opts.row) target.row = opts.row
          if (opts.note !== undefined) target.note = opts.note
          target.updatedAt = now()
          updated = target
        },
        ROOT,
      )
      out({ ok: true, canvas: next.name, frame: frameView(updated, next), ...(from ? { check: await probe(updated) } : {}) })
      return
    }

    case "remove": {
      const state = load()
      const id = rest[0]
      if (!id) fail("remove needs a frame id")
      findFrame(state, id)
      const next = updateCanvas(
        state.name,
        (draft) => {
          draft.frames = draft.frames.filter((item) => item.id !== id)
          draft.comments = draft.comments.filter((item) => item.frameId !== id)
          if (draft.drawings) draft.drawings = draft.drawings.filter((item) => item.frameId !== id)
          if (draft.context.selected === id) draft.context.selected = null
          if (draft.context.focused === id) draft.context.focused = null
        },
        ROOT,
      )
      out({ ok: true, canvas: next.name, removed: id, frames: next.frames.map((item) => item.id) })
      return
    }

    case "list": {
      if (opts.all) {
        out({ ok: true, current: currentName(), canvases: listCanvases(ROOT).map((item) => ({ ...item, url: canvasUrl(item.name) })) })
        return
      }
      const state = load()
      out({
        ok: true,
        canvas: state.name,
        title: state.title,
        url: canvasUrl(state.name),
        rows: rowsOf(state.frames).map(({ row, frames }) => {
          const decision = decisionFor(state, row)
          return { row, decision: decision ? decisionView(decision, state) : null, frames: frames.map((frame) => frameView(frame, state)) }
        }),
        openRequests: openRequests(state).map((request) => requestView(request, state)),
      })
      return
    }

    case "context": {
      const state = load()
      const pick = (id) => (id ? state.frames.find((frame) => frame.id === id) ?? null : null)
      const selected = pick(state.context.selected)
      const focused = pick(state.context.focused)
      const active = focused ?? selected
      out({
        ok: true,
        canvas: state.name,
        url: canvasUrl(state.name),
        selected: selected ? frameView(selected, state) : null,
        focused: focused ? frameView(focused, state) : null,
        comments: active
          ? state.comments.filter((comment) => comment.frameId === active.id && !comment.resolved).map((comment) => commentView(comment, state))
          : [],
        drawings: active
          ? (state.drawings ?? []).filter((drawing) => drawing.frameId === active.id).map((drawing) => drawingView(drawing, state))
          : [],
        viewport: state.context.viewport,
        theme: state.context.theme ?? null,
        updatedAt: state.context.updatedAt,
        openComments: state.comments.filter((comment) => !comment.resolved).length,
        requests: openRequests(state).map((request) => requestView(request, state)),
      })
      return
    }

    case "verdict": {
      const state = load()
      const [id, verdict] = rest
      if (!id) fail("verdict needs a frame id: verdict <frame> pick|maybe|out|none")
      findFrame(state, id)
      if (verdict !== "none" && !VERDICTS.includes(verdict)) fail(`verdict needs one of: ${VERDICTS.join(", ")}, none`)
      let changed
      const next = updateCanvas(
        state.name,
        (draft) => {
          const frame = draft.frames.find((item) => item.id === id)
          if (verdict === "none") delete frame.verdict
          else frame.verdict = verdict
          frame.updatedAt = now()
          changed = frame
        },
        ROOT,
      )
      out({ ok: true, canvas: next.name, frame: frameView(changed, next) })
      return
    }

    case "requests": {
      const state = load()
      const action = rest[0]
      if (action === "done" || action === "cancel") {
        const id = rest[1]
        if (!id) fail(`requests ${action} needs a request id`)
        if (!(state.requests ?? []).some((item) => item.id === id)) fail(`No request "${id}" on canvas "${state.name}"`)
        const made = typeof opts.frames === "string" ? opts.frames.split(",").map((item) => item.trim()).filter(Boolean) : []
        made.forEach((frameId) => findFrame(state, frameId))
        let changed
        const next = updateCanvas(
          state.name,
          (draft) => {
            const request = draft.requests.find((item) => item.id === id)
            request.status = action === "done" ? "done" : "cancelled"
            if (opts.note) request.answer = opts.note
            if (made.length) request.made = made
            request.updatedAt = now()
            changed = request
          },
          ROOT,
        )
        out({ ok: true, canvas: next.name, request: requestView(changed, next) })
        return
      }
      if (action) fail(`Unknown requests action "${action}". Use done or cancel.`)
      const list = (state.requests ?? []).filter((request) => opts.all || request.status === "open")
      out({ ok: true, canvas: state.name, open: openRequests(state).length, requests: list.map((request) => requestView(request, state)) })
      return
    }

    case "decide": {
      const state = load()
      const key = rest[0]
      if (!key) fail("decide needs a row name (or a frame id in that row)")
      const row = state.frames.some((frame) => frame.row === key) ? key : state.frames.find((frame) => frame.id === key)?.row
      if (!row) fail(`No row or frame "${key}"`, { rows: rowsOf(state.frames).map((item) => item.row) })
      const why = typeof opts.why === "string" ? opts.why.trim() : ""
      if (!why) fail('decide needs --why "the reason, in a sentence"')
      const inRow = state.frames.filter((frame) => frame.row === row)
      let winner = null
      if (typeof opts.winner === "string") {
        winner = findFrame(state, opts.winner)
        if (winner.row !== row) fail(`"${winner.id}" is not in row "${row}"`)
      } else {
        const picks = inRow.filter((frame) => frame.verdict === "pick")
        if (picks.length > 1) fail(`Row "${row}" has ${picks.length} picks: pass --winner`, { picks: picks.map((frame) => frame.id) })
        winner = picks[0] ?? null
      }
      const others = inRow.filter((frame) => frame.id !== winner?.id)
      const frozen = []
      const failed = []
      if (!opts.keep) {
        const assets = join(canvasRoot(ROOT), "assets")
        mkdirSync(assets, { recursive: true })
        for (const frame of others) {
          if (frame.kind === "image") continue
          const stored = `${state.name}-${frame.id}-frozen-${Date.now().toString(36)}.png`
          try {
            await screenshot(state, frame, { out: join(assets, stored), theme: opts.theme ?? state.context.theme ?? undefined })
            frozen.push({ id: frame.id, kind: frame.kind, src: frame.src, image: `${ASSET_BASE}/${stored}` })
          } catch (error) {
            failed.push({ id: frame.id, error: error.message })
          }
        }
      }
      const stamp = now()
      const decision = { id: shortId("d"), row, winner: winner?.id ?? null, others: others.map((frame) => frame.id), why, createdAt: stamp }
      const next = updateCanvas(
        state.name,
        (draft) => {
          for (const frame of draft.frames) {
            if (frame.row !== row) continue
            if (winner) frame.verdict = frame.id === winner.id ? "pick" : "out"
            const shot = frozen.find((item) => item.id === frame.id)
            if (shot) {
              frame.frozen = { kind: shot.kind, src: shot.src, at: stamp }
              frame.kind = "image"
              frame.src = shot.image
            }
            frame.updatedAt = stamp
          }
          draft.decisions ??= []
          draft.decisions.push(decision)
        },
        ROOT,
      )
      out({
        ok: true,
        canvas: next.name,
        decision: decisionView(decision, next),
        frozen: frozen.map((item) => item.id),
        ...(failed.length ? { failed } : {}),
      })
      return
    }

    case "decisions": {
      const state = load()
      out({ ok: true, canvas: state.name, decisions: (state.decisions ?? []).map((decision) => decisionView(decision, state)) })
      return
    }

    case "thaw": {
      const state = load()
      const id = rest[0]
      if (!id) fail("thaw needs a frame id")
      const frame = findFrame(state, id)
      if (!frame.frozen) fail(`"${id}" is not frozen`)
      let changed
      const next = updateCanvas(
        state.name,
        (draft) => {
          const target = draft.frames.find((item) => item.id === id)
          target.kind = target.frozen.kind
          target.src = target.frozen.src
          delete target.frozen
          target.updatedAt = now()
          changed = target
        },
        ROOT,
      )
      out({ ok: true, canvas: next.name, frame: frameView(changed, next), check: await probe(changed) })
      return
    }


    case "comments": {
      const state = load()
      const action = rest[0]
      if (action === "reply" || action === "resolve" || action === "reopen") {
        const id = rest[1]
        if (!id) fail(`comments ${action} needs a comment id`)
        findComment(state, id)
        const text = action === "reply" ? rest.slice(2).join(" ").trim() || opts.note : opts.note
        if (action === "reply" && !text) fail('comments reply needs text: comments reply <id> "what changed"')
        let changed
        const next = updateCanvas(
          state.name,
          (draft) => {
            const comment = draft.comments.find((item) => item.id === id)
            const stamp = now()
            if (text) comment.replies.push({ id: shortId("r"), author: "agent", text, createdAt: stamp })
            if (action === "resolve") {
              comment.resolved = true
              if (text) comment.resolution = text
            }
            if (action === "reopen") comment.resolved = false
            comment.updatedAt = stamp
            changed = comment
          },
          ROOT,
        )
        out({ ok: true, canvas: next.name, comment: commentView(changed, next) })
        return
      }
      if (action) fail(`Unknown comments action "${action}". Use reply, resolve or reopen.`)
      const list = state.comments
        .filter((comment) => opts.all || !comment.resolved)
        .filter((comment) => !opts.frame || comment.frameId === opts.frame)
        .map((comment) => commentView(comment, state))
      out({
        ok: true,
        canvas: state.name,
        open: state.comments.filter((comment) => !comment.resolved).length,
        resolved: state.comments.filter((comment) => comment.resolved).length,
        comments: list,
      })
      return
    }

    case "drawings": {
      const state = load()
      const action = rest[0]
      if (action === "remove") {
        const ids = rest.slice(1)
        if (!ids.length) fail("drawings remove needs drawing ids")
        const known = new Set((state.drawings ?? []).map((item) => item.id))
        const missing = ids.filter((id) => !known.has(id))
        if (missing.length) fail(`No drawing ${missing.map((id) => `"${id}"`).join(", ")} on canvas "${state.name}"`)
        const next = updateCanvas(
          state.name,
          (draft) => {
            draft.drawings = (draft.drawings ?? []).filter((item) => !ids.includes(item.id))
          },
          ROOT,
        )
        out({ ok: true, canvas: next.name, removed: ids, left: (next.drawings ?? []).length })
        return
      }
      if (action === "clear") {
        if (opts.frame) findFrame(state, opts.frame)
        const next = updateCanvas(
          state.name,
          (draft) => {
            draft.drawings = opts.frame ? (draft.drawings ?? []).filter((item) => item.frameId !== opts.frame) : []
          },
          ROOT,
        )
        out({ ok: true, canvas: next.name, left: (next.drawings ?? []).length })
        return
      }
      if (action) fail(`Unknown drawings action "${action}". Use remove or clear.`)
      const list = (state.drawings ?? [])
        .filter((drawing) => !opts.frame || drawing.frameId === opts.frame)
        .map((drawing) => drawingView(drawing, state, Boolean(opts.points)))
      out({
        ok: true,
        canvas: state.name,
        count: list.length,
        ...(list.length ? { hint: `See them in place: ${CMD} screenshot <frame> --pins` } : {}),
        drawings: list,
      })
      return
    }

    case "check": {
      const route = typeof opts.route === "string" ? opts.route : rest[0]
      const url = typeof opts.url === "string" ? opts.url : null
      if (!route && !url) fail("check needs --route /path (or --url http://…)")
      const [width, height] = size(DEVICES.desktop)
      const frame = {
        id: `check-${slugify(route ?? url)}`,
        title: route ?? url,
        kind: url ? "url" : "route",
        src: url ?? (route.startsWith("/") ? route : `/${route}`),
        width,
        height,
      }
      const reach = await probe(frame)
      if (!reach.reachable) {
        out({ ok: false, check: reach, hint: `Is the dev server answering on ${ORIGIN}?` })
        process.exit(1)
      }
      try {
        const shot = await screenshot({ name: "check", comments: [], drawings: [] }, frame, { ...opts, pins: false })
        out({ ok: shot.errors.length === 0, check: reach, ...shot })
      } catch (error) {
        fail(error.message, { check: reach })
      }
      return
    }

    case "screenshot": {
      const state = load()
      const id = rest[0] ?? state.context.focused ?? state.context.selected
      if (!id) fail("screenshot needs a frame id (or a frame selected on the canvas)")
      const frame = findFrame(state, id)
      try {
        out({ ok: true, canvas: state.name, frame: frame.id, ...(await screenshot(state, frame)) })
      } catch (error) {
        fail(error.message, { hint: `Is the dev server answering on ${ORIGIN}?` })
      }
      return
    }

    case "open": {
      const name = currentName()
      out({ ok: true, canvas: name, url: canvasUrl(name), exists: canvasExists(name, ROOT) })
      return
    }

    default:
      fail(`Unknown command "${command}". Run: ${CMD} help`)
  }
}

export async function run(argv, config = {}) {
  ROOT = config.cwd ?? process.cwd()
  ORIGIN = (process.env.KOALA_CANVAS_ORIGIN ?? config.origin ?? ORIGIN).replace(/\/+$/, "")
  PAGE = config.page ?? PAGE
  ASSET_BASE = config.assetBase ?? ASSET_BASE
  CMD = config.command ?? CMD
  const parsed = parse(argv)
  opts = parsed.opts
  ;[command, ...rest] = parsed.positionals
  currentFile = join(canvasRoot(ROOT), "current")
  try {
    await main()
  } catch (error) {
    fail(error.message ?? String(error))
  }
}
