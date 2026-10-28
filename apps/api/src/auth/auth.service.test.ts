import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { users } from '../db/schema'
import { createMemoryKv, type Kv } from '../redis/kv'
import { describeWithDatabase, type TestDatabase } from '../test/postgres'
import { SessionsRepository } from '../users/sessions.repository'
import { UsersRepository } from '../users/users.repository'
import { AuthService, normalizeHandoffId } from './auth.service'
import {
  HANDOFF_TTL_MS,
  HANDOFF_WRITE_ATTEMPTS,
  SESSION_CACHE_TTL_SECONDS,
  SESSION_TTL_MS,
} from './policy'

const DAY = 24 * 60 * 60 * 1000

function build(db: TestDatabase, kv: Kv = createMemoryKv()) {
  const sessions = new SessionsRepository(db.database)
  const usersRepo = new UsersRepository(db.database)
  return { auth: new AuthService(kv, usersRepo, sessions), sessions, usersRepo }
}

/**
 * A Kv that hands the next handoff read its value, then runs the `meanwhile`
 * request before the reader continues. That is the window a late bind or confirm tap
 * sits in while another request finishes: it holds a snapshot that is already
 * stale by the time it writes.
 */
function racing(db: TestDatabase) {
  const base = createMemoryKv()
  let pending: (() => Promise<void>) | null = null
  const kv: Kv = {
    ...base,
    async get(key) {
      const value = await base.get(key)
      if (pending && key.startsWith('handoff:')) {
        const run = pending
        pending = null
        await run()
      }
      return value
    },
  }
  return {
    kv,
    auth: build(db, kv).auth,
    meanwhile(run: () => Promise<unknown>) {
      pending = async () => {
        await run()
      }
    },
  }
}

async function begin(auth: AuthService) {
  const started = await auth.start({ ip: '1.1.1.1', context: 'ctx' })
  return { id: started.handoffId, secret: started.bindingSecret }
}

async function confirmed(
  auth: AuthService,
  telegramUserId = '42',
  name = 'Ada',
) {
  const { id, secret } = await begin(auth)
  await auth.bindTelegram(id, telegramUserId, name)
  await auth.confirmTelegram(id, telegramUserId)
  return { id, secret }
}

/** A signed-in session for a Telegram user, opened at `now`. */
async function login(
  auth: AuthService,
  telegramUserId = '42',
  now = Date.now(),
) {
  const { id, secret } = await confirmed(auth, telegramUserId)
  return auth.confirm(id, secret, now)
}

const outcome = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: { status?: number }) => error.status,
  )

afterEach(() => vi.unstubAllEnvs())

describeWithDatabase('AuthService handoff', (current) => {
  const make = () => build(current()).auth

  it('never opens a session before the bot confirmed, even for the right browser', async () => {
    const auth = make()
    const { id, secret } = await begin(auth)
    await expect(auth.confirm(id, secret)).rejects.toMatchObject({
      status: 409,
    })
    await auth.bindTelegram(id, '42', 'Ada')
    await expect(auth.confirm(id, secret)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('opens a hashed cookie session for the bound telegram user', async () => {
    const { auth, usersRepo } = build(current())
    const { id, secret } = await confirmed(auth)
    const opened = await auth.confirm(id, secret)
    expect(opened.secretHash).toMatch(/^[a-f0-9]{64}$/)
    expect(opened.secretHash).not.toBe(opened.token)
    const session = await auth.read(opened.token)
    expect(session).toMatchObject({
      userId: opened.user.id,
      name: 'Ada',
      role: 'learner',
    })
    expect((await usersRepo.get(opened.user.id))?.telegramUserId).toBe('42')
  })

  it('releases the session only to the browser that started the handoff', async () => {
    const auth = make()
    const { id } = await confirmed(auth)
    const other = await begin(auth)
    for (const secret of [undefined, 'guess', other.secret]) {
      await expect(auth.confirm(id, secret)).rejects.toMatchObject({
        status: 403,
      })
    }
  })

  it('is single-use, also under a concurrent double claim', async () => {
    const auth = make()
    const { id, secret } = await confirmed(auth)
    const results = await Promise.all(
      [auth.confirm(id, secret), auth.confirm(id, secret)].map(outcome),
    )
    expect(results.sort()).toEqual([410, 'ok'])
    expect(await outcome(auth.confirm(id, secret))).toBe(410)
  })

  it('binds the first telegram user; later users cannot bind or confirm', async () => {
    const auth = make()
    const { id, secret } = await begin(auth)
    expect(await auth.bindTelegram(id, '1', 'Alice')).toEqual({
      context: 'ctx',
    })
    expect(await auth.bindTelegram(id, '666', 'Mallory')).toBeNull()
    expect(await auth.confirmTelegram(id, '666')).toBe(false)
    await expect(auth.confirm(id, secret)).rejects.toMatchObject({
      status: 409,
    })
    expect(await auth.confirmTelegram(id, '1')).toBe(true)
    const opened = await auth.confirm(id, secret)
    expect(opened.user.telegramUserId).toBe('1')
  })

  it('refuses a confirm tap on a handoff nobody bound', async () => {
    const auth = make()
    const { id } = await begin(auth)
    expect(await auth.confirmTelegram(id, '1')).toBe(false)
    expect(await auth.confirmTelegram('missing', '1')).toBe(false)
  })

  it('expires after five minutes', async () => {
    const auth = make()
    const { id, secret } = await confirmed(auth)
    const late = Date.now() + HANDOFF_TTL_MS + 1000
    await expect(auth.confirm(id, secret, late)).rejects.toMatchObject({
      status: 410,
    })
    expect(await auth.bindTelegram(id, '42', 'Ada', late)).toBeNull()
  })

  it('takes the role from the allowlist on every login', async () => {
    vi.stubEnv('TELEGRAM_TEACHER_ALLOWLIST', '7')
    const auth = make()
    const { id, secret } = await confirmed(auth, '7', 'Teach')
    const opened = await auth.confirm(id, secret)
    expect(opened.user.role).toBe('teacher')
    expect((await auth.read(opened.token))?.role).toBe('teacher')
  })

  it('rate limits /auth/start per ip', async () => {
    const auth = make()
    for (let i = 0; i < 5; i += 1)
      await auth.start({ ip: '9.9.9.9', context: 'c' })
    await expect(
      auth.start({ ip: '9.9.9.9', context: 'c' }),
    ).rejects.toMatchObject({ status: 429 })
  })
})

describeWithDatabase('AuthService handoff races', (current) => {
  it('does not bring a consumed handoff back from a late confirm tap', async () => {
    const { auth, meanwhile } = racing(current())
    const { id, secret } = await begin(auth)
    await auth.bindTelegram(id, '42', 'Ada')

    let first: Awaited<ReturnType<AuthService['confirm']>> | undefined
    meanwhile(async () => {
      await auth.confirmTelegram(id, '42')
      first = await auth.confirm(id, secret)
    })
    expect(await auth.confirmTelegram(id, '42')).toBe(false)

    expect(first?.user.telegramUserId).toBe('42')
    expect(await outcome(auth.confirm(id, secret))).toBe(410)
  })

  it('does not bring a consumed handoff back from a late bind by someone else', async () => {
    const { auth, meanwhile } = racing(current())
    const { id, secret } = await begin(auth)

    meanwhile(async () => {
      await auth.bindTelegram(id, '42', 'Ada')
      await auth.confirmTelegram(id, '42')
      await auth.confirm(id, secret)
    })
    expect(await auth.bindTelegram(id, '666', 'Mallory')).toBeNull()

    expect(await auth.confirmTelegram(id, '666')).toBe(false)
    expect(await outcome(auth.confirm(id, secret))).toBe(410)
  })

  it('keeps the first bound user when a second bind raced the first', async () => {
    const { auth, meanwhile } = racing(current())
    const { id, secret } = await begin(auth)

    meanwhile(() => auth.bindTelegram(id, '1', 'Alice'))
    expect(await auth.bindTelegram(id, '666', 'Mallory')).toBeNull()

    expect(await auth.confirmTelegram(id, '666')).toBe(false)
    expect(await auth.confirmTelegram(id, '1')).toBe(true)
    expect((await auth.confirm(id, secret)).user.telegramUserId).toBe('1')
  })

  it('applies a confirm tap on top of a newer write instead of clobbering it', async () => {
    const { auth, meanwhile } = racing(current())
    const { id, secret } = await begin(auth)
    await auth.bindTelegram(id, '42', 'Ada')

    meanwhile(() => auth.bindTelegram(id, '42', 'Ada Lovelace'))
    expect(await auth.confirmTelegram(id, '42')).toBe(true)

    const opened = await auth.confirm(id, secret)
    expect(opened.user.name).toBe('Ada Lovelace')
  })

  it('fails closed when every write attempt loses the race', async () => {
    const base = createMemoryKv()
    let attempts = 0
    const { auth } = build(current(), {
      ...base,
      async cas() {
        attempts += 1
        return false
      },
    })
    const { id, secret } = await begin(auth)

    expect(await auth.bindTelegram(id, '42', 'Ada')).toBeNull()
    expect(attempts).toBe(HANDOFF_WRITE_ATTEMPTS)
    expect(await auth.confirmTelegram(id, '42')).toBe(false)
    await expect(auth.confirm(id, secret)).rejects.toMatchObject({
      status: 409,
    })
  })
})

describeWithDatabase('AuthService sessions in Postgres', (current) => {
  it('survives a restart: a service with a cold cache still knows the session', async () => {
    const opened = await login(build(current()).auth)
    const restarted = build(current(), createMemoryKv()).auth
    expect(await restarted.read(opened.token)).toEqual({
      userId: opened.user.id,
      role: 'learner',
      name: 'Ada',
    })
  })

  it('serves a read from the cache without asking Postgres', async () => {
    const { auth, sessions } = build(current())
    const touch = vi.spyOn(sessions, 'touch')
    const opened = await login(auth)
    await auth.read(opened.token)
    await auth.read(opened.token)
    expect(touch).not.toHaveBeenCalled()
  })

  it('asks Postgres once when the cache is cold, then serves from the cache', async () => {
    const opened = await login(build(current()).auth)
    const cold = build(current(), createMemoryKv())
    const touch = vi.spyOn(cold.sessions, 'touch')
    expect(await cold.auth.read(opened.token)).not.toBeNull()
    expect(await cold.auth.read(opened.token)).not.toBeNull()
    expect(touch).toHaveBeenCalledTimes(1)
  })

  it('caches a read for five minutes, then asks Postgres again', async () => {
    let clock = Date.now()
    const { auth, sessions } = build(
      current(),
      createMemoryKv(() => clock),
    )
    const touch = vi.spyOn(sessions, 'touch')
    const opened = await login(auth, '42', clock)
    clock += (SESSION_CACHE_TTL_SECONDS - 1) * 1000
    await auth.read(opened.token, clock)
    expect(touch).not.toHaveBeenCalled()
    clock += 2000
    await auth.read(opened.token, clock)
    expect(touch).toHaveBeenCalledTimes(1)
  })

  it('logout revokes the session for every instance and clears the cache', async () => {
    const shared = createMemoryKv()
    const { auth } = build(current(), shared)
    const opened = await login(auth)
    expect(await auth.read(opened.token)).not.toBeNull()
    await auth.logout(opened.token)
    expect(await auth.read(opened.token)).toBeNull()
    expect(await build(current()).auth.read(opened.token)).toBeNull()
    expect(await shared.get(`session:cache:${opened.secretHash}`)).toBeNull()
  })

  it('never lets a cold read re-cache a session revoked mid-read', async () => {
    const base = createMemoryKv()
    let meanwhile: (() => Promise<void>) | null = null
    const kv: Kv = {
      ...base,
      async set(key, value, ttl) {
        if (meanwhile && key.startsWith('session:cache:')) {
          const run = meanwhile
          meanwhile = null
          await run()
        }
        return base.set(key, value, ttl)
      },
    }
    const { auth } = build(current(), kv)
    const opened = await login(auth)
    await kv.del(`session:cache:${opened.secretHash}`)
    meanwhile = () => auth.logout(opened.token)
    expect(await auth.read(opened.token)).toBeNull()
    expect(await kv.get(`session:cache:${opened.secretHash}`)).toBeNull()
    expect(await auth.read(opened.token)).toBeNull()
  })

  it('logout ends only this device', async () => {
    const { auth } = build(current())
    const phone = await login(auth, '42')
    const laptop = await login(auth, '42')
    expect(phone.user.id).toBe(laptop.user.id)
    await auth.logout(phone.token)
    expect(await auth.read(phone.token)).toBeNull()
    expect((await auth.read(laptop.token))?.userId).toBe(laptop.user.id)
  })

  it('ignores a logout without a token or with a token it never issued', async () => {
    const { auth } = build(current())
    await expect(auth.logout(undefined)).resolves.toBeUndefined()
    await expect(auth.logout('never-issued')).resolves.toBeUndefined()
    expect(await auth.read(undefined)).toBeNull()
    expect(await auth.read('never-issued')).toBeNull()
  })

  it('slides the idle window and stops at the 90-day cap', async () => {
    const start = Date.now()
    let clock = start
    const { auth } = build(
      current(),
      createMemoryKv(() => clock),
    )
    const opened = await login(auth, '42', clock)
    for (const day of [29, 58, 87]) {
      clock = start + day * DAY
      expect(await auth.read(opened.token, clock)).not.toBeNull()
    }
    clock = start + 91 * DAY
    expect(await auth.read(opened.token, clock)).toBeNull()
  })

  it('ends a session left idle for 30 days', async () => {
    const start = Date.now()
    let clock = start
    const { auth } = build(
      current(),
      createMemoryKv(() => clock),
    )
    const opened = await login(auth, '42', clock)
    clock = start + SESSION_TTL_MS - 1
    expect(await auth.read(opened.token, clock)).not.toBeNull()
    clock = start + 2 * SESSION_TTL_MS
    expect(await auth.read(opened.token, clock)).toBeNull()
  })

  it('refuses the session of a deleted user', async () => {
    const { auth } = build(current())
    const opened = await login(auth)
    await current()
      .database.db.update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, opened.user.id))
    expect(await build(current()).auth.read(opened.token)).toBeNull()
  })
})

describe('normalizeHandoffId', () => {
  it('restores dashes for telegram start payloads', () => {
    expect(normalizeHandoffId('01a17ecc6cf37882b3be7d39ce083092')).toBe(
      '01a17ecc-6cf3-7882-b3be-7d39ce083092',
    )
  })
})

describeWithDatabase('AuthService deleted users', (current) => {
  it('revokes every session and cache entry when a user is deleted', async () => {
    const shared = createMemoryKv()
    const { auth } = build(current(), shared)
    const phone = await login(auth, '42')
    const laptop = await login(auth, '42')
    await auth.deleteUser(phone.user.id)
    for (const opened of [phone, laptop]) {
      expect(await auth.read(opened.token)).toBeNull()
      expect(await build(current()).auth.read(opened.token)).toBeNull()
    }
  })

  it('refuses a session to a deleted user', async () => {
    const { auth } = build(current())
    const opened = await login(auth, '42')
    await auth.deleteUser(opened.user.id)
    const again = await confirmed(auth, '42')
    await expect(auth.confirm(again.id, again.secret)).rejects.toMatchObject({
      status: 403,
    })
  })
})
