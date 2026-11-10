import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const KOALA_DIR = join(HERE, "koala")
const source = resolve(process.argv[2] ?? process.env.KOALA_UI_DIR ?? join(HERE, "..", "Koala UI React"))

if (!existsSync(join(source, "components", "ui")) || !existsSync(join(source, "packages", "koala-icons"))) {
  console.error(`Not a Koala UI checkout: ${source}\nUsage: npm run sync-koala -- <path to the Koala UI repo>`)
  process.exit(1)
}

const EXTS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"]
const IMPORT =
  /(?:import|export)\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g

const find = (base) => EXTS.map((ext) => base + ext).find((file) => existsSync(file) && statSync(file).isFile()) ?? null

const files = new Set()
const icons = new Set()
const seen = new Set()
const queue = [
  ...readdirSync(join(HERE, "src", "client")).map((name) => join(HERE, "src", "client", name)),
  join(HERE, "ui", "main.tsx"),
]

while (queue.length) {
  const file = queue.pop()
  if (seen.has(file)) continue
  seen.add(file)
  for (const match of readFileSync(file, "utf8").matchAll(IMPORT)) {
    const spec = match[2] || match[3] || match[4]
    if (spec === "koala-icons") {
      const names = match[1]?.match(/\{([\s\S]*)\}/)?.[1] ?? ""
      for (const part of names.split(",")) {
        const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]
        if (name) icons.add(name)
      }
      continue
    }
    const target = spec.startsWith("@/")
      ? find(join(source, spec.slice(2)))
      : spec.startsWith(".")
        ? find(resolve(dirname(file), spec))
        : null
    if (!target) continue
    if (target.startsWith(source)) files.add(relative(source, target).replace(/\\/g, "/"))
    queue.push(target)
  }
}

const styles = ["app/globals.css"]
for (let i = 0; i < styles.length; i++) {
  files.add(styles[i])
  for (const match of readFileSync(join(source, styles[i]), "utf8").matchAll(/@import\s+["'](\.[^"']+\.css)["']/g)) {
    styles.push(relative(source, resolve(dirname(join(source, styles[i])), match[1])).replace(/\\/g, "/"))
  }
}

// This repo is public under MIT: only Koala UI Free files may be copied in. Pro components (the
// "pro" tier in the Koala UI registry) must not end up here.
const registryFile = join(source, "registry.json")
if (existsSync(registryFile)) {
  const pro = new Set(
    JSON.parse(readFileSync(registryFile, "utf8"))
      .items.filter((item) => item.tier === "pro")
      .flatMap((item) => (item.files ?? []).map((f) => (typeof f === "string" ? f : f.path))),
  )
  const blocked = [...files].filter((file) => pro.has(file))
  if (blocked.length) {
    console.error(
      ["These files are Koala UI Pro and cannot be copied into this MIT repo:", ...blocked.map((file) => `  ${file}`), "Build the piece in src/client instead."].join("\n"),
    )
    process.exit(1)
  }
}

for (const file of files) {
  const to = join(KOALA_DIR, file)
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(join(source, file), to)
}

const iconIndex = readFileSync(join(source, "packages/koala-icons/src/index.ts"), "utf8").split(/\r?\n/)
const exports = iconIndex.filter((line) => line.includes("./create-icon"))
mkdirSync(join(KOALA_DIR, "icons", "icons"), { recursive: true })
copyFileSync(join(source, "packages/koala-icons/src/create-icon.tsx"), join(KOALA_DIR, "icons", "create-icon.tsx"))
for (const name of [...icons].sort()) {
  const line = iconIndex.find((item) => item.startsWith(`export { ${name} } from "./icons/`))
  if (!line) throw new Error(`koala-icons has no ${name}`)
  const file = line.match(/\.\/icons\/([^"]+)"/)[1]
  copyFileSync(join(source, "packages/koala-icons/src/icons", `${file}.ts`), join(KOALA_DIR, "icons", "icons", `${file}.ts`))
  exports.push(line)
}
writeFileSync(join(KOALA_DIR, "icons", "index.ts"), `${exports.join("\n")}\n`)
writeFileSync(
  join(KOALA_DIR, "koala.json"),
  `${JSON.stringify({ source: "Koala UI", files: [...files].sort(), icons: [...icons].sort() }, null, 2)}\n`,
)

console.log(JSON.stringify({ ok: true, from: source, files: files.size, icons: icons.size }))
