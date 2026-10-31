import { readFileSync } from 'node:fs'

const css = readFileSync('apps/web/src/styles/tokens.css', 'utf8')
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/)
if (!rootBlock) {
  console.error('FAIL: :root block not found in apps/web/src/styles/tokens.css')
  process.exit(1)
}

const tokens = {}
for (const match of rootBlock[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
  tokens[match[1].trim()] = match[2].trim()
}

const lum = (hex) => {
  const [r, g, b] = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(hex.slice(index + 1, index + 3), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const pairs = [
  ['white on accent-solid', '#ffffff', '--accent-solid'],
  ['bg on accent-solid', '--bg', '--accent-solid'],
  ['bg on ink', '--bg', '--ink'],
  ['accent-ink on accent-soft', '--accent-ink', '--accent-soft'],
  ['ink-2 on accent-soft', '--ink-2', '--accent-soft'],
  ['accent on bg', '--accent', '--bg'],
  ['accent on bg-alt', '--accent', '--bg-alt'],
  ['muted on bg', '--muted', '--bg'],
  ['muted on bg-alt', '--muted', '--bg-alt'],
  ['on-accent on accent-2', '--on-accent', '--accent-2'],
  ['warn on warn-soft', '--warn', '--warn-soft'],
  ['warn on bg', '--warn', '--bg'],
  ['danger on danger-soft', '--danger', '--danger-soft'],
  ['danger on bg', '--danger', '--bg'],
  ['live on bg', '--live', '--bg'],
  ['white on danger', '#ffffff', '--danger'],
]

let failed = false
for (const [label, fg, bg] of pairs) {
  const fgHex = fg.startsWith('#') ? fg : tokens[fg]
  const bgHex = bg.startsWith('#') ? bg : tokens[bg]
  if (!fgHex || !bgHex) {
    console.error(`FAIL ${label}: missing token`)
    failed = true
    continue
  }
  const score = ratio(fgHex, bgHex)
  const ok = score >= 4.5
  console.log(`${ok ? 'ok' : 'FAIL'} ${score.toFixed(2)} ${label}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
