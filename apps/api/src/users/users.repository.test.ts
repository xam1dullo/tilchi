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

  describe('searchLearners', () => {
    const learner = (name: string | null, extra = {}) =>
      current()
        .database.db.insert(users)
        .values({ id: uuidv7(), role: 'learner', name, ...extra })
        .returning({ id: users.id })
        .then(([row]) => row.id)

    it('finds active learners by name, case-insensitively, without contact details', async () => {
      const ada = await learner('Ada Lovelace', {
        level: 'A2',
        phone: '+998901234567',
        telegramId: '77',
        goal: 'IELTS',
        source: 'ad',
        guardianConsentBy: 'Mother',
        guardianConsentAt: new Date(),
      })
      const gone = await learner('Ada Gone', { deletedAt: new Date() })
      await repo().ensure({ id: uuidv7(), role: 'teacher', name: 'Ada T' })
      await learner(null)
      const found = await repo().searchLearners('  aDA ')
      expect(found).toEqual([
        { id: ada, name: 'Ada Lovelace', level: 'A2', guardianConsent: true },
      ])
      expect(found.map((u) => u.id)).not.toContain(gone)
    })

    it('reports consent only when both who and when are recorded', async () => {
      await learner('Kid One', { guardianConsentBy: 'Mother' })
      const [hit] = await repo().searchLearners('kid')
      expect(hit.guardianConsent).toBe(false)
    })

    it('treats LIKE wildcards and backslashes in the query literally', async () => {
      const percent = await learner('50% Off')
      const under = await learner('a_b')
      const slash = await learner('x\\y')
      await learner('5000 Off')
      await learner('axb')
      await learner('xzy')
      expect((await repo().searchLearners('0%')).map((u) => u.id)).toEqual([
        percent,
      ])
      expect((await repo().searchLearners('a_')).map((u) => u.id)).toEqual([
        under,
      ])
      expect((await repo().searchLearners('x\\')).map((u) => u.id)).toEqual([
        slash,
      ])
      expect(await repo().searchLearners('%%')).toEqual([])
    })

    it('needs 2 characters, caps at 20 and orders by name then id', async () => {
      await learner('Bo')
      expect(await repo().searchLearners(' b ')).toEqual([])
      expect(await repo().searchLearners('')).toEqual([])
      const names = Array.from(
        { length: 25 },
        (_, i) => `Zed ${String(i).padStart(2, '0')}`,
      )
      for (const name of [...names].reverse()) await learner(name)
      const found = await repo().searchLearners('zed')
      expect(found.map((u) => u.name)).toEqual(names.slice(0, 20))
    })
  })

  describe('recordGuardianConsent', () => {
    it('stores who and when on an active user only', async () => {
      const user = await repo().upsertTelegram('42', 'Kid')
      const now = new Date('2026-10-30T10:00:00Z')
      expect(await repo().recordGuardianConsent(user.id, 'Mother', now)).toBe(
        true,
      )
      const [row] = await current()
        .database.db.select()
        .from(users)
        .where(eq(users.id, user.id))
      expect(row.guardianConsentBy).toBe('Mother')
      expect(row.guardianConsentAt).toEqual(now)
      expect(await repo().recordGuardianConsent(uuidv7(), 'X')).toBe(false)
      expect(await repo().recordGuardianConsent('nope', 'X')).toBe(false)
      await repo().softDelete(user.id)
      expect(await repo().recordGuardianConsent(user.id, 'Father')).toBe(false)
    })

    it('never rewrites a consent already on record, even when racing', async () => {
      const user = await repo().upsertTelegram('43', 'Kid')
      const mother = new Date('2026-10-30T10:00:00Z')
      const neighbour = new Date('2026-10-30T11:00:00Z')
      const results = await Promise.all([
        repo().recordGuardianConsent(user.id, 'Mother', mother),
        repo().recordGuardianConsent(user.id, 'Neighbour', neighbour),
      ])
      expect(results).toEqual([true, true])
      const later = new Date('2026-10-31T10:00:00Z')
      expect(await repo().recordGuardianConsent(user.id, 'Uncle', later)).toBe(
        true,
      )
      const [row] = await current()
        .database.db.select()
        .from(users)
        .where(eq(users.id, user.id))
      // One racer wins whole: its giver with its own time, never a mix.
      const won = row.guardianConsentBy === 'Mother' ? mother : neighbour
      expect(['Mother', 'Neighbour']).toContain(row.guardianConsentBy)
      expect(row.guardianConsentAt).toEqual(won)
    })

    it('is for learners only', async () => {
      const teacher = await repo().ensure({
        id: uuidv7(),
        role: 'teacher',
        name: 'T',
      })
      expect(await repo().recordGuardianConsent(teacher.id, 'X')).toBe(false)
      const [row] = await current()
        .database.db.select()
        .from(users)
        .where(eq(users.id, teacher.id))
      expect(row.guardianConsentBy).toBeNull()
    })
  })
})
