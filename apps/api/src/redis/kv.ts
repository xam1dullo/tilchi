import Redis from 'ioredis'

export type Kv = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  /** Read and delete in one step. Only one caller ever gets the value. */
  take(key: string): Promise<string | null>
  /**
   * Replace the value only while it still equals `expected`, keeping the
   * expiry. Never creates a key, and never brings back one that was taken or
   * has expired, so a stale read-modify-write cannot undo a `take`.
   */
  cas(key: string, expected: string, next: string): Promise<boolean>
  incr(key: string, ttlSeconds: number): Promise<number>
}

type MemoryEntry = { value: string; expiresAt: number }

export function createMemoryKv(now = () => Date.now()): Kv {
  const store = new Map<string, MemoryEntry>()
  return {
    async get(key) {
      const entry = store.get(key)
      if (!entry) return null
      if (entry.expiresAt <= now()) {
        store.delete(key)
        return null
      }
      return entry.value
    },
    async set(key, value, ttlSeconds) {
      store.set(key, { value, expiresAt: now() + ttlSeconds * 1000 })
    },
    async del(key) {
      store.delete(key)
    },
    async take(key) {
      const entry = store.get(key)
      store.delete(key)
      if (!entry || entry.expiresAt <= now()) return null
      return entry.value
    },
    async cas(key, expected, next) {
      const entry = store.get(key)
      if (!entry) return false
      if (entry.expiresAt <= now()) {
        store.delete(key)
        return false
      }
      if (entry.value !== expected) return false
      store.set(key, { value: next, expiresAt: entry.expiresAt })
      return true
    },
    async incr(key, ttlSeconds) {
      const current = Number((await this.get(key)) ?? '0')
      const next = current + 1
      await this.set(key, String(next), ttlSeconds)
      return next
    },
  }
}

/** KEEPTTL needs Redis 6.0 or newer. One script, so the check and write are atomic. */
const CAS_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
  return 1
end
return 0
`

export type RedisKv = Kv & { close(): Promise<void> }

export function createRedisKv(url: string): RedisKv {
  const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
  return {
    async close() {
      if (client.status !== 'wait') await client.quit()
    },
    async get(key) {
      await ensure(client)
      return client.get(key)
    },
    async set(key, value, ttlSeconds) {
      await ensure(client)
      await client.set(key, value, 'EX', ttlSeconds)
    },
    async del(key) {
      await ensure(client)
      await client.del(key)
    },
    async take(key) {
      await ensure(client)
      return client.getdel(key)
    },
    async cas(key, expected, next) {
      await ensure(client)
      return (await client.eval(CAS_SCRIPT, 1, key, expected, next)) === 1
    },
    async incr(key, ttlSeconds) {
      await ensure(client)
      const next = await client.incr(key)
      if (next === 1) await client.expire(key, ttlSeconds)
      return next
    },
  }
}

async function ensure(client: Redis) {
  if (client.status === 'wait') await client.connect()
}

export function createKvFromEnv(env = process.env): Kv {
  const url = env.REDIS_URL?.trim()
  if (!url) return createMemoryKv()
  return createRedisKv(url)
}
