import { existsSync, mkdirSync, readFileSync, statSync, watch, writeFileSync } from "node:fs"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import path from "node:path"

import { applyCanvasOp, type CanvasOp } from "./ops"
import { DEFAULT_CANVAS, canvasRoot, emptyCanvas, isCanvasName, listCanvases, now, readCanvas, writeCanvas } from "./store"

export const UI_PREFIX = "/__canvas"
export const API_BASE = `${UI_PREFIX}/api`

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
}

export interface ServeOptions {
  cwd: string
  port: number
  host: string
  target: string | null
  uiDir: string
}

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify(body))
}

const readBody = (req: http.IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let data = ""
    req.setEncoding("utf8")
    req.on("data", (chunk) => {
      data += chunk
      if (data.length > 1_000_000) req.destroy()
    })
    req.on("end", () => resolve(data))
    req.on("error", reject)
  })

export function currentName(cwd: string) {
  const file = path.join(canvasRoot(cwd), "current")
  if (!existsSync(file)) return DEFAULT_CANVAS
  const saved = readFileSync(file, "utf8").trim()
  return isCanvasName(saved) ? saved : DEFAULT_CANVAS
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL, cwd: string) {
  const rest = url.pathname.slice(API_BASE.length)
  const asked = url.searchParams.get("c")

  if (rest.startsWith("/asset/")) {
    const file = path.basename(decodeURIComponent(rest.slice("/asset/".length)))
    const full = path.join(canvasRoot(cwd), "assets", file)
    const type = TYPES[path.extname(file).toLowerCase()]
    if (!type || !existsSync(full)) return json(res, 404, { error: "Not found" })
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" })
    return res.end(readFileSync(full))
  }

  if (rest === "/stream") {
    if (!isCanvasName(asked)) return json(res, 400, { error: "Invalid canvas name" })
    const root = canvasRoot(cwd)
    mkdirSync(root, { recursive: true })
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    })
    let lastRev = -1
    let timer: ReturnType<typeof setTimeout> | null = null
    const push = () => {
      try {
        const state = readCanvas(asked, cwd)
        if (!state || state.rev === lastRev) return
        lastRev = state.rev
        res.write(`data: ${JSON.stringify(state)}\n\n`)
      } catch {}
    }
    const watcher = watch(root, (_event, file) => {
      if (file && file !== `${asked}.json`) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(push, 40)
    })
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 20000)
    req.on("close", () => {
      watcher.close()
      clearInterval(heartbeat)
      if (timer) clearTimeout(timer)
    })
    push()
    return
  }

  if (rest === "" || rest === "/") {
    if (req.method === "GET") {
      if (url.searchParams.has("info")) return json(res, 200, { app: "koala-poc-canvas", dir: path.resolve(cwd) })
      if (url.searchParams.has("list")) return json(res, 200, { current: currentName(cwd), canvases: listCanvases(cwd) })
      const name = asked && isCanvasName(asked) ? asked : currentName(cwd)
      const state = readCanvas(name, cwd) ?? writeCanvas(emptyCanvas(name), cwd)
      return json(res, 200, state)
    }
    if (req.method === "POST") {
      if (!isCanvasName(asked)) return json(res, 400, { error: "Invalid canvas name" })
      if (!readCanvas(asked, cwd)) return json(res, 404, { error: `Canvas "${asked}" does not exist` })
      try {
        const body = JSON.parse(await readBody(req)) as CanvasOp
        return json(res, 200, { ok: true, ...applyCanvasOp(asked, body, cwd) })
      } catch (error) {
        return json(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  return json(res, 404, { error: "Not found" })
}

function serveUi(res: http.ServerResponse, url: URL, uiDir: string) {
  let rel = decodeURIComponent(url.pathname.slice(UI_PREFIX.length)) || "/"
  if (rel === "/") rel = "/index.html"
  const full = path.join(uiDir, path.normalize(rel).replace(/^([/\\])+/, ""))
  if (!full.startsWith(uiDir)) return json(res, 403, { error: "Forbidden" })
  const file = existsSync(full) && statSync(full).isFile() ? full : path.join(uiDir, "index.html")
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream"
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
  })
  res.end(readFileSync(file))
}

const HOP = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer"])

function proxy(req: http.IncomingMessage, res: http.ServerResponse, target: URL) {
  const client = target.protocol === "https:" ? https : http
  const headers: http.OutgoingHttpHeaders = {}
  for (const [key, value] of Object.entries(req.headers)) if (!HOP.has(key)) headers[key] = value
  headers.host = target.host
  const upstream = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: req.url,
      headers,
    },
    (answer) => {
      const out: http.OutgoingHttpHeaders = {}
      for (const [key, value] of Object.entries(answer.headers)) {
        if (HOP.has(key) || key === "x-frame-options") continue
        if (key === "content-security-policy" && typeof value === "string") {
          const kept = value
            .split(";")
            .filter((part) => !part.trim().toLowerCase().startsWith("frame-ancestors"))
            .join(";")
          if (kept.trim()) out[key] = kept
          continue
        }
        if (key === "location" && typeof value === "string" && value.startsWith(target.origin)) {
          out[key] = value.slice(target.origin.length) || "/"
          continue
        }
        out[key] = value
      }
      res.writeHead(answer.statusCode ?? 502, out)
      answer.pipe(res)
    },
  )
  upstream.on("error", (error) => {
    if (res.headersSent) return res.destroy()
    res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" })
    res.end(
      `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="3"><body style="font:14px system-ui;padding:24px;color:#555">` +
        `Koala POC Canvas could not reach <b>${target.origin}</b> (${(error as NodeJS.ErrnoException).code ?? error.message}). Is the project's dev server running?</body>`,
    )
  })
  req.pipe(upstream)
}

function proxyUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer, target: URL) {
  const port = Number(target.port || (target.protocol === "https:" ? 443 : 80))
  const upstream = net.connect(port, target.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`]
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i]
      lines.push(`${key}: ${key.toLowerCase() === "host" ? target.host : req.rawHeaders[i + 1]}`)
    }
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`)
    if (head.length) upstream.write(head)
    upstream.pipe(socket)
    socket.pipe(upstream)
  })
  upstream.on("error", () => socket.destroy())
  socket.on("error", () => upstream.destroy())
}

export function serve(options: ServeOptions) {
  const target = options.target ? new URL(options.target) : null
  mkdirSync(canvasRoot(options.cwd), { recursive: true })

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost")
    if (url.pathname.startsWith(API_BASE)) {
      handleApi(req, res, url, options.cwd).catch((error) => json(res, 500, { error: String(error) }))
      return
    }
    if (url.pathname === UI_PREFIX || url.pathname.startsWith(`${UI_PREFIX}/`)) return serveUi(res, url, options.uiDir)
    if (url.pathname === "/" && !target) {
      res.writeHead(302, { Location: `${UI_PREFIX}/` })
      return res.end()
    }
    if (!target) return json(res, 404, { error: "No --target set: frames can only use --url or --image." })
    proxy(req, res, target)
  })

  server.on("upgrade", (req, socket, head) => {
    if (!target || (req.url ?? "").startsWith(UI_PREFIX)) return socket.destroy()
    proxyUpgrade(req, socket as net.Socket, head, target)
  })

  return new Promise<http.Server>((resolve, reject) => {
    server.once("error", reject)
    server.listen(options.port, options.host, () => {
      writeFileSync(
        path.join(canvasRoot(options.cwd), "server.json"),
        `${JSON.stringify({ port: options.port, host: options.host, target: options.target, pid: process.pid, startedAt: now() }, null, 2)}\n`,
      )
      resolve(server)
    })
  })
}
