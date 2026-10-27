import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryKv, type Kv } from '../redis/kv'
import { UserStore } from '../users/user-store'
import { AuthService, normalizeHandoffId } from './auth.service'
import { HANDOFF_TTL_MS, HANDOFF_WRITE_ATTEMPTS } from './policy'

const make = () => AuthService.forTest(createMemoryKv(), new UserStore())

/**
 * A Kv that hands the next handoff read its value, then runs the `meanwhile`
 * request before the reader continues. That is the window a late bind or confirm tap
 * sits in while another request finishes: it holds a snapshot that is already
 * stale by the time it writes.
 */
function racing() {
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
    auth: AuthService.forTest(kv, new UserStore()),
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

const outcome = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: { status?: number }) => error.status,
  )

afterEach(() => vi.unstubAllEnvs())

describe('AuthService handoff', () => {
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
    const auth = make()
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
    expect(auth.userStore().get(opened.user.id)?.telegramUserId).toBe('42')
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

describe('AuthService handoff races', () => {
  it('does not bring a consumed handoff back from a late confirm tap', async () => {
    const { auth, meanwhile } = racing()
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
    const { auth, meanwhile } = racing()
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
    const { auth, meanwhile } = racing()
    const { id, secret } = await begin(auth)

    meanwhile(() => auth.bindTelegram(id, '1', 'Alice'))
    expect(await auth.bindTelegram(id, '666', 'Mallory')).toBeNull()

    expect(await auth.confirmTelegram(id, '666')).toBe(false)
    expect(await auth.confirmTelegram(id, '1')).toBe(true)
    expect((await auth.confirm(id, secret)).user.telegramUserId).toBe('1')
  })

  it('applies a confirm tap on top of a newer write instead of clobbering it', async () => {
    const { auth, meanwhile } = racing()
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
    const auth = AuthService.forTest(
      {
        ...base,
        async cas() {
          attempts += 1
          return false
        },
      },
      new UserStore(),
    )
    const { id, secret } = await begin(auth)

    expect(await auth.bindTelegram(id, '42', 'Ada')).toBeNull()
    expect(attempts).toBe(HANDOFF_WRITE_ATTEMPTS)
    expect(await auth.confirmTelegram(id, '42')).toBe(false)
    await expect(auth.confirm(id, secret)).rejects.toMatchObject({
      status: 409,
    })
  })
})

describe('normalizeHandoffId', () => {
  it('restores dashes for telegram start payloads', () => {
    expect(normalizeHandoffId('01a17ecc6cf37882b3be7d39ce083092')).toBe(
      '01a17ecc-6cf3-7882-b3be-7d39ce083092',
    )
  })
})
