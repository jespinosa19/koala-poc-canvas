import { chmodSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import tailwind from "@tailwindcss/postcss"
import react from "@vitejs/plugin-react"
import { build } from "vite"

const HERE = dirname(fileURLToPath(import.meta.url))
const KOALA = join(HERE, "koala")
const alias = {
  "@": KOALA,
  "koala-icons": join(KOALA, "icons/index.ts"),
}
const quiet = (warning, warn) => {
  if (warning.code === "MODULE_LEVEL_DIRECTIVE" || /use client/.test(warning.message ?? "")) return
  warn(warning)
}

rmSync(join(HERE, "dist"), { recursive: true, force: true })

await build({
  configFile: false,
  root: join(HERE, "ui"),
  base: "/__canvas/",
  logLevel: "warn",
  plugins: [react()],
  resolve: { alias },
  css: { postcss: { plugins: [tailwind({ base: join(HERE, "ui") })] } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: join(HERE, "dist/ui"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { onwarn: quiet },
  },
})

await build({
  configFile: false,
  root: HERE,
  logLevel: "warn",
  build: {
    ssr: join(HERE, "src/bin.mjs"),
    outDir: join(HERE, "dist"),
    emptyOutDir: false,
    target: "node20",
    minify: false,
    rollupOptions: {
      onwarn: quiet,
      output: { entryFileNames: "cli.mjs", banner: "#!/usr/bin/env node" },
    },
  },
})

chmodSync(join(HERE, "dist/cli.mjs"), 0o755)
process.stdout.write(`${JSON.stringify({ ok: true, out: join(HERE, "dist") })}\n`)
