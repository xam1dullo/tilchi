import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { uuidv7 } from '../id'
import { groupMembers, groups, lessons, meetings, users } from './schema'
import { type TestDb, createTestDb, pgCode, resetTestDb } from './testing'

let db: TestDb

beforeAll(async () => {
  db = await createTestDb()
})

afterAll(async () => {
  await db.$client.close()
})

beforeEach(async () => {
  await resetTestDb(db)
})

async function teacher() {
  const id = uuidv7()
  await db.insert(users).values({ id, role: 'teacher' })
  return id
}

async function group(teacherId: string, capacity = 12) {
  const id = uuidv7()
  await db.insert(groups).values({ id, name: 'G', capacity, teacherId })
  return id
}

describe('schema constraints', () => {
  it('keeps a group between 1 and 12 learners', async () => {
    const teacherId = await teacher()
    await expect(group(teacherId, 12)).resolves.toBeDefined()
    for (const capacity of [0, 13]) {
      const error = await group(teacherId, capacity).catch((e) => e)
      expect(pgCode(error)).toBe('23514')
    }
  })

  it('refuses a group whose teacher is missing or unknown', async () => {
    const unknown = await db
      .insert(groups)
      .values({ id: uuidv7(), name: 'G', teacherId: uuidv7() })
      .catch((e) => e)
    expect(pgCode(unknown)).toBe('23503')

    const missing = await db
      .insert(groups)
      .values({ id: uuidv7(), name: 'G', teacherId: null as never })
      .catch((e) => e)
    expect(pgCode(missing)).toBe('23502')
  })

  it('lists a learner once per group', async () => {
    const groupId = await group(await teacher())
    const userId = uuidv7()
    await db.insert(users).values({ id: userId })
    await db.insert(groupMembers).values({ groupId, userId })
    const error = await db
      .insert(groupMembers)
      .values({ groupId, userId })
      .catch((e) => e)
    expect(pgCode(error)).toBe('23505')
  })

  it('gives a lesson exactly one meeting and each meeting its own room', async () => {
    const groupId = await group(await teacher())
    const lessonId = uuidv7()
    await db.insert(lessons).values({
      id: lessonId,
      groupId,
      scheduledAt: new Date('2026-11-02T10:00:00Z'),
    })
    await db
      .insert(meetings)
      .values({ id: uuidv7(), lessonId, livekitRoom: 'room-a' })
    const second = await db
      .insert(meetings)
      .values({ id: uuidv7(), lessonId, livekitRoom: 'room-b' })
      .catch((e) => e)
    expect(pgCode(second)).toBe('23505')
  })

  it('maps one telegram account to one user', async () => {
    await db.insert(users).values({ id: uuidv7(), telegramUserId: '42' })
    const error = await db
      .insert(users)
      .values({ id: uuidv7(), telegramUserId: '42' })
      .catch((e) => e)
    expect(pgCode(error)).toBe('23505')
  })
})
