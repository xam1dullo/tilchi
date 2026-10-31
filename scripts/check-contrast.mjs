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

// Text pairs: WCAG AA normal text, 4.5:1.
const pairs = [
  ['on-accent on accent-solid', '--on-accent', '--accent-solid'],
  ['white on accent-solid', '#ffffff', '--accent-solid'],
  ['on-accent on accent-2', '--on-accent', '--accent-2'],
  ['on-accent-muted on accent-2', '--on-accent-muted', '--accent-2'],
  ['bg on ink', '--bg', '--ink'],
  ['accent-ink on accent-soft', '--accent-ink', '--accent-soft'],
  ['ink-2 on accent-soft', '--ink-2', '--accent-soft'],
  ['muted on accent-soft', '--muted', '--accent-soft'],
  ['accent-ink on bg', '--accent-ink', '--bg'],
  ['accent-ink on bg-elev', '--accent-ink', '--bg-elev'],
  ['accent on bg', '--accent', '--bg'],
  ['accent on bg-alt', '--accent', '--bg-alt'],
  ['accent on bg-elev', '--accent', '--bg-elev'],
  ['accent on accent-soft', '--accent', '--accent-soft'],
  ['accent-2 on bg-elev', '--accent-2', '--bg-elev'],
  ['ink on bg', '--ink', '--bg'],
  ['ink-2 on bg-alt', '--ink-2', '--bg-alt'],
  ['muted on bg', '--muted', '--bg'],
  ['muted on bg-alt', '--muted', '--bg-alt'],
  ['muted on bg-elev', '--muted', '--bg-elev'],
  ['ink-2 on bg-elev', '--ink-2', '--bg-elev'],
  ['ink on bg-elev', '--ink', '--bg-elev'],
  ['warn on warn-soft', '--warn', '--warn-soft'],
  ['warn on bg', '--warn', '--bg'],
  ['danger on danger-soft', '--danger', '--danger-soft'],
  ['danger on bg', '--danger', '--bg'],
  ['live on bg', '--live', '--bg'],
  ['white on danger', '#ffffff', '--danger'],
]

// Non-text pairs: WCAG 1.4.11 focus rings and state indicators, 3:1.
const uiPairs = [
  ['focus on bg', '--focus', '--bg'],
  ['focus on bg-alt', '--focus', '--bg-alt'],
  ['focus on bg-elev', '--focus', '--bg-elev'],
  ['focus on accent-soft', '--focus', '--accent-soft'],
  ['accent-solid on bg', '--accent-solid', '--bg'],
  ['accent-solid on bg-elev', '--accent-solid', '--bg-elev'],
]

// Prohibited for text. Each must stay below 4.5; if one passes, the rule is
// stale: move it into `pairs` and drop it from design.md.
const prohibited = [
  ['bg on accent-solid', '--bg', '--accent-solid'],
  ['accent-solid on bg', '--accent-solid', '--bg'],
  ['accent-solid on bg-alt', '--accent-solid', '--bg-alt'],
]

const hex = (value) => (value.startsWith('#') ? value : tokens[value])

let failed = false
const check = (list, min) => {
  for (const [label, fg, bg] of list) {
    const fgHex = hex(fg)
    const bgHex = hex(bg)
    if (!fgHex || !bgHex) {
      console.error(`FAIL ${label}: missing token`)
      failed = true
      continue
    }
    const score = ratio(fgHex, bgHex)
    const ok = score >= min
    console.log(`${ok ? 'ok' : 'FAIL'} ${score.toFixed(2)} ${label} (>=${min})`)
    if (!ok) failed = true
  }
}

check(pairs, 4.5)
check(uiPairs, 3)

for (const [label, fg, bg] of prohibited) {
  const score = ratio(hex(fg), hex(bg))
  const stale = score >= 4.5
  console.log(
    `${stale ? 'FAIL stale' : 'PROHIBITED'} ${score.toFixed(2)} ${label} (text never uses this pair)`,
  )
  if (stale) failed = true
}

if (failed) process.exit(1)
