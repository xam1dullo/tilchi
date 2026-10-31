import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('./classroom.css', import.meta.url)),
  'utf8',
)

/** Every value of `property` across all `selector { ... }` rules, media queries included. */
function values(selector: string, property: string): string[] {
  const rule = new RegExp(
    `(?:^|\\s)${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`,
    'g',
  )
  return [...css.matchAll(rule)].flatMap(([, body = '']) =>
    [...body.matchAll(new RegExp(`${property}:\\s*([^;]+);`, 'g'))].map(
      ([, value = '']) => value.trim(),
    ),
  )
}

describe('meeting control styles', () => {
  it('keeps every meeting control at least 44px square, on phones too', () => {
    for (const property of ['min-width', 'min-height']) {
      const sizes = values('.meet-control', property)
      expect(sizes.length).toBeGreaterThan(0)
      for (const size of sizes) {
        expect(size).toMatch(/^\d+px$/)
        expect(Number.parseInt(size, 10)).toBeGreaterThanOrEqual(44)
      }
    }
  })

  it('never removes the focus outline, so focus stays visible', () => {
    expect(css).not.toMatch(/outline:\s*(none|0)\b/)
  })

  it('draws the tile on the ink token and the control bar on a light surface', () => {
    expect(values('.meet-tile', 'background')).toEqual(['var(--meet-bg)'])
    expect(values('.meet-controls', 'background')).toEqual(['var(--bg-elev)'])
  })

  // Terracotta made outlined leave, pressed toggles and primary look alike.
  it('fills leave with danger so it never reads as a pressed toggle', () => {
    expect(values('.meet-leave', 'background')).toEqual(['var(--danger)'])
    expect(values('.meet-leave', 'color')).toEqual(['#ffffff'])
    expect(css).toMatch(
      /\.meet-control\[aria-pressed="true"\]\s*\{[^}]*background:\s*var\(--accent-soft\)/,
    )
  })
})

describe('notice tones', () => {
  const base = readFileSync(
    fileURLToPath(new URL('./base.css', import.meta.url)),
    'utf8',
  )
  const rule = (selector: string) =>
    [...base.matchAll(new RegExp(`${selector}\\s*\\{([^}]*)\\}`, 'g'))]
      .map(([, body]) => body)
      .join('\n')

  it('keeps done neutral and gives done and error a glyph, not colour alone', () => {
    const done = rule('\\.notice\\[data-tone="done"\\]')
    expect(done).toContain('var(--ink-2)')
    expect(done).not.toMatch(/accent|success|danger/)
    expect(rule('\\.notice\\[data-tone="done"\\]::before')).toMatch(
      /content:\s*"\\2713"/,
    )
    expect(rule('\\.notice\\[data-tone="error"\\]::before')).toMatch(
      /content:\s*"!"/,
    )
  })
})
