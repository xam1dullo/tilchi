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
})
