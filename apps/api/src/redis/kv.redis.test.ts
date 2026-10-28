import { randomUUID } from 'node:crypto'
import Redis from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRedisKv, type RedisKv } from './kv'

/**
 * The Lua behind `cas` only runs on a real Redis (6.0+ for KEEPTTL):
 *   TEST_REDIS_URL=redis://127.0.0.1:6379 pnpm --filter @tilchi/api test
 */
const url = process.env.TEST_REDIS_URL

describe.skipIf(!url)('createRedisKv against a real Redis', () => {
  let kv: RedisKv
  let raw: Redis
  const key = () => `kv-test:${randomUUID()}`

  beforeAll(() => {
    kv = createRedisKv(url as string)
    raw = new Redis(url as string)
  })
  afterAll(async () => {
    await kv.close()
    await raw.quit()
  })

  it('swaps while the value is the expected one and keeps the expiry', async () => {
    const k = key()
    await kv.set(k, 'one', 100)
    expect(await kv.cas(k, 'one', 'two')).toBe(true)
    expect(await kv.get(k)).toBe('two')
    const ttl = await raw.ttl(k)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(100)
    await kv.del(k)
  })

  it('leaves a changed value alone', async () => {
    const k = key()
    await kv.set(k, 'two', 100)
    expect(await kv.cas(k, 'one', 'three')).toBe(false)
    expect(await kv.get(k)).toBe('two')
    await kv.del(k)
  })

  it('never creates a missing key or brings back a taken one', async () => {
    const missing = key()
    expect(await kv.cas(missing, 'x', 'y')).toBe(false)
    expect(await kv.get(missing)).toBeNull()

    const taken = key()
    await kv.set(taken, 'one', 100)
    expect(await kv.take(taken)).toBe('one')
    expect(await kv.cas(taken, 'one', 'two')).toBe(false)
    expect(await kv.get(taken)).toBeNull()
  })

  it('lets exactly one of many racing swaps win', async () => {
    const k = key()
    await kv.set(k, 'start', 100)
    const wins = await Promise.all(
      Array.from({ length: 10 }, (_, i) => kv.cas(k, 'start', `winner-${i}`)),
    )
    expect(wins.filter(Boolean)).toHaveLength(1)
    await kv.del(k)
  })
})
