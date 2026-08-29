import { readFileSync } from 'node:fs'

const css = readFileSync('src/app/globals.css', 'utf8')

const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/)
if (!rootBlock) {
  console.error('FAIL: :root block not found in src/app/globals.css')
  process.exit(1)
}

const tokens = {}
for (const m of rootBlock[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
  tokens[m[1].trim()] = m[2].trim()
}

const resolve = (v) => {
  v = v.trim()
  if (v.startsWith('#')) return v
  const m = v.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/)
  if (m) return oklchToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
  const varM = v.match(/^var\((--[\w-]+)\)$/)
  if (varM) return resolve(tokens[varM[1]])
  throw new Error(`cannot parse color: ${v}`)
}

function oklchToHex(l, c, h) {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const cube = (x) => x * x * x
  const [l3, m3, s3] = [cube(l_), cube(m_), cube(s_)]
  const rgb = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
  const toCss = (v) => {
    v = Math.min(1, Math.max(0, v))
    const c8 = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
    return Math.round(c8 * 255).toString(16).padStart(2, '0')
  }
  return `#${rgb.map(toCss).join('').toUpperCase()}`
}

const pairs = [
  ['btn-primary matn (#fff)', '#FFFFFF', '--accent-solid'],
  ['accent-soft badge matn (#7A2E1D)', '--accent-ink', '--accent-soft'],
  ['accent (#C8593E) — bg', '--accent', '--bg'],
  ['accent step-num — bg-elev', '--accent', '--bg-elev'],
  ['accent-ink matn — bg', '--accent-ink', '--bg'],
  ['success icon — bg-elev', '--success', '--bg-elev'],
  ['ink-2 matn', '--ink-2', '--bg'],
  ['muted matn', '--muted', '--bg'],
  ['muted matn — bg-elev', '--muted', '--bg-elev'],
  ['tg btn matn (#fff)', '#FFFFFF', '--tg'],
]

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

let fail = false
for (const [label, fg, bg] of pairs) {
  const fgHex = fg.startsWith('#') ? fg : resolve(tokens[fg])
  const bgHex = bg.startsWith('#') ? bg : resolve(tokens[bg])
  const r = ratio(fgHex, bgHex)
  const aa = r >= 4.5 ? 'AA ✓' : r >= 3 ? 'AA-large ✓' : '✗'
  console.log(`${r.toFixed(2).padStart(5)}  ${aa.padEnd(10)}  ${label}`)
  if (r < 3) fail = true
}
if (fail) {
  console.error('FAIL: contrast below 3:1 (AA-large)')
  process.exit(1)
}
console.log('contrast OK')
