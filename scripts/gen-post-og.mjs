import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const DIR = 'content/posts'
const OUT = 'public/og'
const W = 1200
const H = 630
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function wrap(text, max) {
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function fmtDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d}-${MONTHS[m - 1]}, ${y}`
}

function parseFrontmatter(file) {
  const raw = readFileSync(join(DIR, file), 'utf8')
  const m = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return null
  const fm = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/)
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '')
  }
  return fm
}

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.mdx'))) {
  const fm = parseFrontmatter(file)
  if (!fm || fm.draft === 'true') continue
  const slug = file.replace(/\.mdx$/, '')
  const title = fm.title ?? slug
  const date = fmtDate(fm.date ?? '')
  const size = title.length > 55 ? 52 : 64
  const lines = wrap(title, 26).slice(0, 3)
  const ys = 300 - ((lines.length - 1) * (size + 12)) / 2
  const text = lines
    .map((l, i) => `<text x="96" y="${ys + i * (size + 12)}" font-family="Georgia, serif" font-size="${size}" font-weight="500" letter-spacing="-1" fill="#171512">${esc(l)}</text>`)
    .join('\n')
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#F5EFE4"/>
  <rect y="0" width="${W}" height="10" fill="#A8452E"/>
  <rect x="96" y="96" width="64" height="64" rx="18" fill="#A8452E"/>
  <text x="128" y="143" font-family="Georgia, serif" font-size="42" font-weight="700" font-style="italic" text-anchor="middle" fill="#F5EFE4">t</text>
  <text x="176" y="146" font-family="Georgia, serif" font-size="46" font-weight="500" letter-spacing="-1" fill="#171512">tilchi</text>
  <text x="96" y="600" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#3D372F">${esc(date)}</text>
  ${text}
</svg>`
  await sharp(Buffer.from(svg)).png().toFile(join(OUT, `${slug}.png`))
  console.log(`public/og/${slug}.png written`)
}
