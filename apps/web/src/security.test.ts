import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

describe('session storage', () => {
  it('does not keep the session in browser storage', () => {
    const root = fileURLToPath(new URL('.', import.meta.url))
    const hits = files(root).filter((path) => {
      if (path.endsWith('security.test.ts')) return false
      const text = readFileSync(path, 'utf8')
      return text.includes('localStorage') || text.includes('sessionStorage')
    })
    expect(hits).toEqual([])
  })
})
