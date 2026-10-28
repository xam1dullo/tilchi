import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { roomOptions } from './meet-livekit'

describe('roomOptions', () => {
  it('turns on simulcast, adaptive stream and dynacast', () => {
    const options = roomOptions()
    expect(options.adaptiveStream).toBe(true)
    expect(options.dynacast).toBe(true)
    expect(options.publishDefaults?.simulcast).toBe(true)
  })
})

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    const isSource = path.endsWith('.ts') || path.endsWith('.tsx')
    return isSource && !path.endsWith('.test.ts') ? [path] : []
  })
}

// A static import of the SDK would drag ~500 KB into the initial bundle. Only
// `import type` (erased) and `import('livekit-client')` (its own chunk) may
// appear, and the dynamic one only in the adapter.
const staticImport = /^import\s+(?!type\s)[^'";]*from\s+['"]livekit-client['"]/m
const bareImport = /^import\s+['"]livekit-client['"]/m

describe('livekit-client loading', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const files = sources(root)

  it('is never statically imported, so the SDK stays out of the initial bundle', () => {
    const offenders = files.filter((path) => {
      const text = readFileSync(path, 'utf8')
      return staticImport.test(text) || bareImport.test(text)
    })
    expect(offenders).toEqual([])
  })
})
