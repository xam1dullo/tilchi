import { afterEach, describe, expect, it } from 'vitest'
import { UserStore, roleForTelegram } from './user-store'

describe('roleForTelegram', () => {
  const prevTeacher = process.env.TELEGRAM_TEACHER_ALLOWLIST
  const prevAdmin = process.env.TELEGRAM_ADMIN_ALLOWLIST

  afterEach(() => {
    if (prevTeacher === undefined) delete process.env.TELEGRAM_TEACHER_ALLOWLIST
    else process.env.TELEGRAM_TEACHER_ALLOWLIST = prevTeacher
    if (prevAdmin === undefined) delete process.env.TELEGRAM_ADMIN_ALLOWLIST
    else process.env.TELEGRAM_ADMIN_ALLOWLIST = prevAdmin
  })

  it('maps allow-lists and defaults to learner with no parent', () => {
    process.env.TELEGRAM_TEACHER_ALLOWLIST = 't1'
    process.env.TELEGRAM_ADMIN_ALLOWLIST = 'a1'
    expect(roleForTelegram('a1')).toBe('admin')
    expect(roleForTelegram('t1')).toBe('teacher')
    expect(roleForTelegram('x')).toBe('learner')
  })
})

describe('UserStore', () => {
  it('upserts by telegram id', () => {
    const store = new UserStore()
    const first = store.upsertTelegram('42', 'Ada')
    const second = store.upsertTelegram('42', 'Ada Lovelace')
    expect(second.id).toBe(first.id)
    expect(second.name).toBe('Ada Lovelace')
    expect(store.get(first.id)?.telegramUserId).toBe('42')
  })
})
