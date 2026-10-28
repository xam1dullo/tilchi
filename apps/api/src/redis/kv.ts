import Redis from 'ioredis'

export type Kv = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
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
    async incr(key, ttlSeconds) {
      const current = Number((await this.get(key)) ?? '0')
      const next = current + 1
      await this.set(key, String(next), ttlSeconds)
      return next
    },
  }
}

export function createRedisKv(url: string): Kv {
  const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
  return {
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
