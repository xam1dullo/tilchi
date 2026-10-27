import { describe, expect, it } from 'vitest'
import { createMemoryKv } from '../redis/kv'
import { UserStore } from '../users/user-store'
import { AuthService, normalizeHandoffId } from './auth.service'

describe('AuthService deep link', () => {
  it('binds telegram then confirms into a cookie session', async () => {
    const auth = AuthService.forTest(createMemoryKv(), new UserStore())
    const started = auth.start({ ip: '1.1.1.1', telegramKey: '42' })
    await expect(auth.confirm(started.handoffId)).rejects.toMatchObject({
      response: { error: 'handoff_pending' },
    })
    await auth.bindTelegram(started.handoffId, '42', 'Ada')
    const opened = await auth.confirm(started.handoffId)
    expect(opened.user.telegramUserId).toBe('42')
    const session = await auth.read(opened.token)
    expect(session?.userId).toBe(opened.user.id)
    expect(session?.role).toBe('learner')
  })
})

describe('normalizeHandoffId', () => {
  it('restores dashes for telegram start payloads', () => {
    expect(normalizeHandoffId('01a17ecc6cf37882b3be7d39ce083092')).toBe(
      '01a17ecc-6cf3-7882-b3be-7d39ce083092',
    )
  })
})
