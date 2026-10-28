import { describe, expect, it } from 'vitest'
import { createMemoryKv } from '../redis/kv'
import { UserStore } from '../users/user-store'
import { AuthService, normalizeHandoffId } from './auth.service'

describe('AuthService deep link', () => {
  it('refuses an unconfirmed handoff and creates no session', async () => {
    const kv = createMemoryKv()
    const auth = AuthService.forTest(kv, new UserStore())
    const started = await auth.start({ ip: '1.1.1.1', telegramKey: '42' })
    await expect(auth.confirm(started.handoffId)).rejects.toMatchObject({
      response: { error: 'handoff_pending' },
    })
    expect(await kv.get(`session:cache:x`)).toBeNull()
    const keys = await Promise.all(
      ['a', 'b'].map(async () => auth.read('not-a-real-token')),
    )
    expect(keys).toEqual([null, null])
  })

  it('binds telegram then confirms into a hashed cookie session', async () => {
    const auth = AuthService.forTest(createMemoryKv(), new UserStore())
    const started = await auth.start({ ip: '1.1.1.1', telegramKey: '42' })
    await auth.bindTelegram(started.handoffId, '42', 'Ada')
    const opened = await auth.confirm(started.handoffId)
    expect(opened.secretHash).toMatch(/^[a-f0-9]{64}$/)
    expect(opened.secretHash).not.toBe(opened.token)
    const session = await auth.read(opened.token)
    expect(session?.userId).toBe(opened.user.id)
    expect(session?.role).toBe('learner')
  })

  it('refuses unconfirmed handoffs in production like an unset webhook', async () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const auth = AuthService.forTest(createMemoryKv(), new UserStore())
      const started = await auth.start({ ip: '1.1.1.1', telegramKey: '7' })
      await expect(auth.confirm(started.handoffId)).rejects.toMatchObject({
        response: { error: 'handoff_unconfirmed' },
      })
    } finally {
      process.env.NODE_ENV = prev
    }
  })
})

describe('normalizeHandoffId', () => {
  it('restores dashes for telegram start payloads', () => {
    expect(normalizeHandoffId('01a17ecc6cf37882b3be7d39ce083092')).toBe(
      '01a17ecc-6cf3-7882-b3be-7d39ce083092',
    )
  })
})
