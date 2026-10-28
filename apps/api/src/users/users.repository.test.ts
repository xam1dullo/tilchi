import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { users } from '../db/schema'
import { uuidv7 } from '../id'
import { describeWithDatabase } from '../test/postgres'
import {
  DeletedUserError,
  UsersRepository,
  roleForTelegram,
} from './users.repository'

describe('roleForTelegram', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('maps allow-lists and defaults to learner with no parent', () => {
    vi.stubEnv('TELEGRAM_TEACHER_ALLOWLIST', 't1')
    vi.stubEnv('TELEGRAM_ADMIN_ALLOWLIST', 'a1')
    expect(roleForTelegram('a1')).toBe('admin')
    expect(roleForTelegram('t1')).toBe('teacher')
    expect(roleForTelegram('x')).toBe('learner')
  })

  it('trims list entries and ignores empty ones', () => {
    vi.stubEnv('TELEGRAM_TEACHER_ALLOWLIST', ' t1 , ,t2')
    vi.stubEnv('TELEGRAM_ADMIN_ALLOWLIST', '')
    expect(roleForTelegram('t1')).toBe('teacher')
    expect(roleForTelegram('t2')).toBe('teacher')
    expect(roleForTelegram('')).toBe('learner')
  })
})

describeWithDatabase('UsersRepository', (current) => {
  afterEach(() => vi.unstubAllEnvs())
  const repo = () => new UsersRepository(current().database)

  it('creates a learner the first time and finds the same user again', async () => {
    const created = await repo().upsertTelegram('42', 'Ada')
    expect(created).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      telegramUserId: '42',
      role: 'learner',
      name: 'Ada',
    })
    expect(await repo().get(created.id)).toEqual(created)
  })

  it('is idempotent per telegram id and keeps the name when none is given', async () => {
    const first = await repo().upsertTelegram('42', 'Ada')
    const renamed = await repo().upsertTelegram('42', 'Ada Lovelace')
    expect(renamed.id).toBe(first.id)
    expect(renamed.name).toBe('Ada Lovelace')
    for (const blank of [undefined, null, '']) {
      expect((await repo().upsertTelegram('42', blank)).name).toBe(
        'Ada Lovelace',
      )
    }
    expect((await repo().upsertTelegram('43')).name).toBeNull()
  })

  it('takes the role from the allowlists on every login', async () => {
    vi.stubEnv('TELEGRAM_TEACHER_ALLOWLIST', '7')
    expect((await repo().upsertTelegram('7', 'Teach')).role).toBe('teacher')
    vi.stubEnv('TELEGRAM_TEACHER_ALLOWLIST', '')
    vi.stubEnv('TELEGRAM_ADMIN_ALLOWLIST', '7')
    expect((await repo().upsertTelegram('7', 'Teach')).role).toBe('admin')
    vi.stubEnv('TELEGRAM_ADMIN_ALLOWLIST', '')
    expect((await repo().upsertTelegram('7', 'Teach')).role).toBe('learner')
  })

  it('makes one user out of racing first logins', async () => {
    const [a, b] = await Promise.all([
      repo().upsertTelegram('9', 'One'),
      repo().upsertTelegram('9', 'Two'),
    ])
    expect(a.id).toBe(b.id)
    const rows = await current().database.db.select().from(users)
    expect(rows).toHaveLength(1)
  })

  it('does not find unknown, malformed, or deleted users', async () => {
    const user = await repo().upsertTelegram('42', 'Ada')
    expect(await repo().get(uuidv7())).toBeNull()
    expect(await repo().get('not-a-uuid')).toBeNull()
    await current()
      .database.db.update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, user.id))
    expect(await repo().get(user.id)).toBeNull()
  })

  it('never signs a deleted user back in or revives the row', async () => {
    const user = await repo().upsertTelegram('42', 'Ada')
    await repo().softDelete(user.id)
    await expect(repo().upsertTelegram('42', 'Ada')).rejects.toBeInstanceOf(
      DeletedUserError,
    )
    expect(await repo().get(user.id)).toBeNull()
    const [row] = await current().database.db.select().from(users)
    expect(row.deletedAt).not.toBeNull()
  })

  it('ensures a fixed-id user once and never rewrites it', async () => {
    const id = uuidv7()
    const first = await repo().ensure({ id, role: 'teacher', name: 'Demo' })
    const second = await repo().ensure({ id, role: 'admin', name: 'Other' })
    expect(first).toEqual({
      id,
      telegramUserId: null,
      role: 'teacher',
      name: 'Demo',
    })
    expect(second).toEqual(first)
  })
})
