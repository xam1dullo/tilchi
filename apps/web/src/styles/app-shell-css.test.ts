import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (file: string) =>
  readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')

describe('app chrome styles', () => {
  it('draws the sticky top bar on a solid surface so content never shows through', () => {
    const rule = read('./app-shell.css').match(/\n\.app-topbar \{([^}]*)\}/)
    expect(rule?.[1]).toMatch(/background: var\(--bg\);/)
  })

  it('keeps tags neutral unless a tone gives the colour a meaning', () => {
    const base = read('./base.css')
    const tag = base.match(/\n\.tag \{([^}]*)\}/)?.[1] ?? ''
    expect(tag).not.toMatch(/accent/)
    expect(base).toMatch(/\.tag\[data-tone="mark"\]/)
    expect(base).toMatch(/\.tag\[data-tone="warn"\]/)
  })

  it('stacks the attempt table into cards on narrow screens instead of scrolling', () => {
    const css = read('./classroom.css')
    const phone = css.split('@container (max-width: 30rem)')[1] ?? ''
    expect(phone).toMatch(/\.attempt-table tbody tr \{\s*display: grid;/)
    expect(phone).toMatch(/content: attr\(data-label\)/)
  })

  it('gives the submitted time its own line so the learner name is not squeezed', () => {
    const phone =
      read('./classroom.css').split('@container (max-width: 30rem)')[1] ?? ''
    expect(phone).toMatch(
      /\.attempt-table tbody td:last-child \{\s*grid-column: 1 \/ -1;/,
    )
  })

  it('lays the four attempt counts out 2 by 2 in a narrow group page, never 3 + 1', () => {
    const css = read('./classroom.css')
    expect(css).toMatch(
      /\.group-page \.assignment-counts \{[^}]*repeat\(2, minmax\(0, 1fr\)\)/,
    )
    expect(css).toMatch(
      /@container group \(min-width: 32rem\) \{\s*\.group-page \.assignment-counts \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/,
    )
  })

  it('numbers questions in plain muted figures, not accent italics', () => {
    const rule =
      read('./classroom.css').match(
        /\.tests-section \.question-index \{([^}]*)\}/,
      )?.[1] ?? ''
    expect(rule).not.toMatch(/italic|accent/)
    expect(rule).toMatch(/tabular-nums/)
  })
})
