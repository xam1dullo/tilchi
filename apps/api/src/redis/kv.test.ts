import { describe, expect, it } from 'vitest'
import { createMemoryKv } from './kv'

describe('createMemoryKv', () => {
  it('expires values after the ttl', async () => {
    let now = 1_000
    const kv = createMemoryKv(() => now)
    await kv.set('a', '1', 5)
    expect(await kv.get('a')).toBe('1')
    now = 6_000
    expect(await kv.get('a')).toBeNull()
  })
})
