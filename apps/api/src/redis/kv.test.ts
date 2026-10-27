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

  it('increments inside a ttl window', async () => {
    const kv = createMemoryKv()
    expect(await kv.incr('rate:ip:1', 60)).toBe(1)
    expect(await kv.incr('rate:ip:1', 60)).toBe(2)
  })

  it('hands a taken value to one caller only', async () => {
    const kv = createMemoryKv()
    await kv.set('handoff:1', 'v', 60)
    const winners = await Promise.all([
      kv.take('handoff:1'),
      kv.take('handoff:1'),
    ])
    expect(winners.filter((value) => value === 'v')).toHaveLength(1)
    expect(await kv.get('handoff:1')).toBeNull()
  })

  it('does not take an expired value', async () => {
    let now = 1_000
    const kv = createMemoryKv(() => now)
    await kv.set('a', '1', 5)
    now = 6_000
    expect(await kv.take('a')).toBeNull()
  })
})
