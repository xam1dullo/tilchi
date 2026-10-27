import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { users } from '../db/schema'
import { type TestDb, createTestDb, resetTestDb } from '../db/testing'
import { UsersRepository } from './users.repository'

let db: TestDb
let repo: UsersRepository

beforeAll(async () => {
  db = await createTestDb()
  repo = new UsersRepository(db)
})

afterAll(async () => {
  await db.$client.close()
})

beforeEach(async () => {
  await resetTestDb(db)
})

describe('UsersRepository.upsertTelegram', () => {
  it('creates a user for a new telegram account', async () => {
    const user = await repo.upsertTelegram({
      telegramUserId: '42',
      role: 'learner',
      name: 'Aziza',
    })
    expect(user).toMatchObject({
      telegramUserId: '42',
      role: 'learner',
      name: 'Aziza',
    })
    expect(user?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('returns the same user id on every later login', async () => {
    const first = await repo.upsertTelegram({
      telegramUserId: '42',
      role: 'learner',
    })
    const second = await repo.upsertTelegram({
      telegramUserId: '42',
      role: 'learner',
    })
    expect(second?.id).toBe(first?.id)
  })

  it('follows the allow-list in both directions', async () => {
    const asTeacher = await repo.upsertTelegram({
      telegramUserId: '7',
      role: 'teacher',
    })
    expect(asTeacher?.role).toBe('teacher')
    const demoted = await repo.upsertTelegram({
      telegramUserId: '7',
      role: 'learner',
    })
    expect(demoted).toMatchObject({ id: asTeacher?.id, role: 'learner' })
  })

  it('fills a missing name but never overwrites a stored one', async () => {
    await repo.upsertTelegram({ telegramUserId: '5', role: 'learner' })
    const named = await repo.upsertTelegram({
      telegramUserId: '5',
      role: 'learner',
      name: 'From Telegram',
    })
    expect(named?.name).toBe('From Telegram')
    const kept = await repo.upsertTelegram({
      telegramUserId: '5',
      role: 'learner',
      name: 'Someone Else',
    })
    expect(kept?.name).toBe('From Telegram')
  })

  it('refuses a soft-deleted account and leaves it untouched', async () => {
    const created = await repo.upsertTelegram({
      telegramUserId: '9',
      role: 'learner',
    })
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, created?.id as string))
    const again = await repo.upsertTelegram({
      telegramUserId: '9',
      role: 'admin',
    })
    expect(again).toBeNull()
    const [row] = await db.select().from(users)
    expect(row.role).toBe('learner')
  })
})

describe('UsersRepository.findActive', () => {
  it('finds a live user by id and hides a deleted one', async () => {
    const created = await repo.upsertTelegram({
      telegramUserId: '11',
      role: 'teacher',
    })
    expect(await repo.findActive(created?.id as string)).toMatchObject({
      role: 'teacher',
    })
    await db.update(users).set({ deletedAt: new Date() })
    expect(await repo.findActive(created?.id as string)).toBeNull()
  })
})
