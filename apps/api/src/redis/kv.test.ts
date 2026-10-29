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

  it('increments concurrent calls atomically', async () => {
    const kv = createMemoryKv()
    expect(await Promise.all([kv.incr('k', 60), kv.incr('k', 60)])).toEqual([
      1, 2,
    ])
  })

  it('keeps the initial counter expiry when incremented again', async () => {
    let now = 1_000
    const kv = createMemoryKv(() => now)
    expect(await kv.incr('k', 10)).toBe(1)
    now = 9_000
    expect(await kv.incr('k', 10)).toBe(2)
    now = 11_000
    expect(await kv.incr('k', 10)).toBe(1)
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

describe('createMemoryKv cas', () => {
  it('swaps only while the stored value is still the expected one', async () => {
    const kv = createMemoryKv()
    await kv.set('k', 'one', 60)
    expect(await kv.cas('k', 'one', 'two')).toBe(true)
    expect(await kv.get('k')).toBe('two')
    expect(await kv.cas('k', 'one', 'three')).toBe(false)
    expect(await kv.get('k')).toBe('two')
  })

  it('never creates a missing key or brings back a taken one', async () => {
    const kv = createMemoryKv()
    expect(await kv.cas('absent', 'x', 'y')).toBe(false)
    expect(await kv.get('absent')).toBeNull()

    await kv.set('k', 'one', 60)
    await kv.take('k')
    expect(await kv.cas('k', 'one', 'two')).toBe(false)
    expect(await kv.get('k')).toBeNull()
  })

  it('does not swap an expired key', async () => {
    let now = 1_000
    const kv = createMemoryKv(() => now)
    await kv.set('k', 'one', 5)
    now = 6_000
    expect(await kv.cas('k', 'one', 'two')).toBe(false)
    expect(await kv.get('k')).toBeNull()
  })

  it('keeps the original expiry instead of extending it', async () => {
    let now = 1_000
    const kv = createMemoryKv(() => now)
    await kv.set('k', 'one', 10)
    now = 6_000
    expect(await kv.cas('k', 'one', 'two')).toBe(true)
    now = 11_001
    expect(await kv.get('k')).toBeNull()
  })

  it('lets exactly one of two racing swaps win', async () => {
    const kv = createMemoryKv()
    await kv.set('k', 'one', 60)
    const wins = await Promise.all([
      kv.cas('k', 'one', 'a'),
      kv.cas('k', 'one', 'b'),
    ])
    expect(wins.filter(Boolean)).toHaveLength(1)
  })
})
