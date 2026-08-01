import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BUDGET_KB = 320
const chunksDir = 'out/_next/static/chunks'
const outDir = 'out'

if (!statSync(chunksDir, { throwIfNoEntry: false })) {
  console.error('out/ missing — run pnpm build first')
  process.exit(1)
}

const chunks = readdirSync(chunksDir).filter((f) => f.endsWith('.js'))
const sizes = chunks.map((f) => {
  const raw = readFileSync(join(chunksDir, f))
  return { file: f, raw: raw.length, gzip: gzipSync(raw).length }
})
const total = sizes.reduce((n, s) => n + s.gzip, 0)
const totalKb = total / 1024

console.log(`total JS chunks (gzip): ${totalKb.toFixed(0)} KB / ${BUDGET_KB} KB budget`)

const gsapChunks = new Set(
  sizes.filter((s) => readFileSync(join(chunksDir, s.file), 'utf8').includes('ScrollSmoother')).map((s) => s.file)
)
if (gsapChunks.size > 0) {
  console.log(`animation chunks (gzip): ${[...gsapChunks].map((f) => `${f} ${(sizes.find((s) => s.file === f).gzip / 1024).toFixed(0)}KB`).join(', ')}`)
}

const articleFiles = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name === 'index.html' && p.startsWith(join(outDir, 'blog')) && p !== join(outDir, 'blog', 'index.html'))
      articleFiles.push(p)
  }
}
walk(outDir)

const leaks = []
for (const file of articleFiles) {
  const html = readFileSync(file, 'utf8')
  for (const chunk of gsapChunks) {
    if (html.includes(chunk)) leaks.push(`${file} -> ${chunk}`)
  }
}

let fail = false
if (totalKb > BUDGET_KB) {
  console.error(`FAIL: total JS ${totalKb.toFixed(0)} KB exceeds ${BUDGET_KB} KB budget`)
  fail = true
}
if (leaks.length > 0) {
  console.error('FAIL: animation JS shipped to article pages:\n' + leaks.join('\n'))
  fail = true
}
if (fail) process.exit(1)
console.log('JS budget OK')
