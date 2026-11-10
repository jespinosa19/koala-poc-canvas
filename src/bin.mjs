import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { parse, run } from "./cli.mjs"
import { API_BASE, UI_PREFIX, serve } from "./server.ts"
import { canvasRoot } from "./store.ts"

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = resolve(HERE, "..")
const UI_DIR = [join(HERE, "ui"), join(PKG, "dist", "ui")].find((dir) => existsSync(join(dir, "index.html")))
const SKILL = join(PKG, "skill", "SKILL.md")
const SKILL_AGENTS = join(PKG, "skill", "agents")

const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
const argv = process.argv.slice(2)
const { opts, positionals } = parse(argv)
const cwd = resolve(typeof opts.dir === "string" ? opts.dir : process.cwd())

const sameDir = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase()

const probeServer = async (origin) => {
  try {
    const response = await fetch(`${origin}${API_BASE}?info`, { signal: AbortSignal.timeout(1500) })
    const body = await response.json()
    return (body?.app === "koala-poc-canvas" || body?.app === "koala-canvas") ? body : null
  } catch {
    return null
  }
}

const serverInfo = () => {
  try {
    return JSON.parse(readFileSync(join(canvasRoot(cwd), "server.json"), "utf8"))
  } catch {
    return null
  }
}

if (positionals[0] === "serve") {
  if (!UI_DIR) {
    print({ ok: false, error: "The canvas UI is not built. Run: npm run build (in the koala-poc-canvas repo)" })
    process.exit(1)
  }
  const port = Number(opts.port ?? process.env.KOALA_CANVAS_PORT ?? 4848)
  const host = typeof opts.host === "string" ? opts.host : "127.0.0.1"
  const target = typeof opts.target === "string" ? opts.target.replace(/\/+$/, "") : null
  try {
    await serve({ cwd, port, host, target, uiDir: UI_DIR })
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      const other = await probeServer(`http://localhost:${port}`)
      print({
        ok: false,
        error: other
          ? sameDir(other.dir, cwd)
            ? `Koala POC Canvas is already running for this folder on port ${port}. Reuse it: http://localhost:${port}${UI_PREFIX}/`
            : `Port ${port} is used by Koala POC Canvas for another folder (${other.dir}). Use --port with a free port.`
          : `Port ${port} is busy. Use --port.`,
      })
    } else {
      print({ ok: false, error: String(error.message ?? error) })
    }
    process.exit(1)
  }
  let reachable = null
  if (target) {
    try {
      await fetch(target, { signal: AbortSignal.timeout(5000) })
      reachable = true
    } catch {
      reachable = false
    }
  }
  print({
    ok: true,
    url: `http://localhost:${port}${UI_PREFIX}/`,
    target,
    targetReachable: reachable,
    dir: canvasRoot(cwd),
    hint: target
      ? "Frames: koala-poc-canvas add --route /path --title T (routes are served from the target through this server)."
      : "No --target: frames can use --url or --image. Pass --target http://localhost:5173 to frame your dev server's routes.",
  })
} else if (positionals[0] === "skill") {
  const project = Boolean(argv.includes("--project"))
  const base = project ? join(cwd, ".claude") : join(homedir(), ".claude")
  const dest = join(base, "skills", "koala-poc-canvas")
  mkdirSync(dest, { recursive: true })
  copyFileSync(SKILL, join(dest, "SKILL.md"))
  // The research, builder and review agents the skill dispatches (Claude Code subagents).
  const agentsDir = join(base, "agents")
  const agents = existsSync(SKILL_AGENTS) ? readdirSync(SKILL_AGENTS).filter((file) => file.endsWith(".md")) : []
  if (agents.length) mkdirSync(agentsDir, { recursive: true })
  for (const file of agents) copyFileSync(join(SKILL_AGENTS, file), join(agentsDir, file))
  // Before the rename the skill and agents were called koala-canvas*: take ours off so the agent does
  // not see two copies. Only files that are ours (they name Koala Canvas) are removed.
  const ours = (file) => {
    try {
      return /Koala Canvas/.test(readFileSync(file, "utf8"))
    } catch {
      return false
    }
  }
  const removed = []
  const oldSkill = join(base, "skills", "koala-canvas")
  if (ours(join(oldSkill, "SKILL.md"))) {
    rmSync(oldSkill, { recursive: true, force: true })
    removed.push(oldSkill)
  }
  for (const role of ["researcher", "builder", "reviewer"]) {
    const file = join(agentsDir, `koala-canvas-${role}.md`)
    if (ours(file)) {
      rmSync(file, { force: true })
      removed.push(file)
    }
  }
  print({
    ok: true,
    installed: join(dest, "SKILL.md"),
    agents: agents.map((file) => join(agentsDir, file)),
    ...(removed.length ? { removedOldNames: removed } : {}),
    scope: project ? "project" : "user",
  })
} else {
  const info = serverInfo()
  const origin = (process.env.KOALA_CANVAS_ORIGIN ?? (info ? `http://localhost:${info.port}` : "http://localhost:4848")).replace(/\/+$/, "")
  if (positionals[0] && !["help", "comments", "context", "use", "drawings", "check"].includes(positionals[0])) {
    const live = await probeServer(origin)
    if (live && !sameDir(live.dir, cwd)) {
      process.stderr.write(
        `${JSON.stringify({
          warning: `The canvas server at ${origin} serves another folder (${live.dir}), not ${cwd}. The page will not show this folder's canvases. Start one here: koala-poc-canvas serve --target <dev server> --port <free port>`,
        })}\n`,
      )
    } else if (!live && ["add", "init", "open", "update"].includes(positionals[0])) {
      process.stderr.write(
        `${JSON.stringify({ warning: `No canvas server answers at ${origin} for this folder. Start it: koala-poc-canvas serve --target <dev server>` })}\n`,
      )
    }
  }
  await run(argv, {
    cwd,
    origin,
    page: `${UI_PREFIX}/`,
    assetBase: `${API_BASE}/asset`,
    command: "koala-poc-canvas",
  })
}
