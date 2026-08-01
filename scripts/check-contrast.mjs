const pairs = [
  ['btn-primary matn (#fff)', '#FFFFFF', '#A8452E'],
  ['accent-soft badge matn (#7A2E1D)', '#7A2E1D', '#F0D9CE'],
  ['accent (#C8593E) — bg', '#C8593E', '#F5EFE4'],
  ['ink-2 matn', '#3D372F', '#F5EFE4'],
  ['muted matn', '#6E6858', '#F5EFE4'],
  ['ink-3 matn — bg-elev', '#6B6558', '#FBF7F0'],
  ['tg btn matn (#fff)', '#FFFFFF', '#16719E'],
  ['deep karta matn (#F5EFE4)', '#F5EFE4', '#241C16'],
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

for (const [label, fg, bg] of pairs) {
  const r = ratio(fg, bg)
  const aa = r >= 4.5 ? 'AA ✓' : r >= 3 ? 'AA-large ✓' : '✗'
  console.log(`${r.toFixed(2).padStart(5)}  ${aa.padEnd(10)}  ${label}`)
}
