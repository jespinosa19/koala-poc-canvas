import { copyFileSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import tailwind from "@tailwindcss/postcss"
import react from "@vitejs/plugin-react"
import { build } from "vite"

const HERE = dirname(fileURLToPath(import.meta.url))
const KOALA = join(HERE, "koala")
const OUT = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(HERE, "dist-demo")

rmSync(join(OUT, "assets"), { recursive: true, force: true })

await build({
  configFile: false,
  root: join(HERE, "ui"),
  base: "./",
  logLevel: "warn",
  plugins: [react()],
  resolve: { alias: { "@": KOALA, "koala-icons": join(KOALA, "icons/index.ts") } },
  css: { postcss: { plugins: [tailwind({ base: join(HERE, "ui") })] } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: OUT,
    emptyOutDir: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: join(HERE, "ui/demo.html"),
      onwarn: (warning, warn) => {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE" || /use client/.test(warning.message ?? "")) return
        warn(warning)
      },
    },
  },
})
copyFileSync(join(HERE, "ui/demo-frame.html"), join(OUT, "frame.html"))
process.stdout.write(`${JSON.stringify({ ok: true, out: OUT })}\n`)
