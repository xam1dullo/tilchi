import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type TestDb, createTestDb, pgCode, resetTestDb } from '../db/testing'
import { GroupsRepository } from '../groups/groups.repository'
import { insertUser } from '../testing/people'
import { LessonsRepository } from './lessons.repository'

let db: TestDb
let groups: GroupsRepository
let repo: LessonsRepository

beforeAll(async () => {
  db = await createTestDb()
  groups = new GroupsRepository(db)
  repo = new LessonsRepository(db)
})

afterAll(async () => {
  await db.$client.close()
})

beforeEach(async () => {
  await resetTestDb(db)
})

const UNKNOWN = '0192f000-0000-7000-8000-000000000000'
const at = (iso: string) => new Date(iso)

async function world() {
  const admin = await insertUser(db, 'admin', 'Admin')
  const teacher = await insertUser(db, 'teacher', 'Mukhtasar')
  const other = await insertUser(db, 'teacher', 'Dilnoza')
  const aziza = await insertUser(db, 'learner', 'Aziza')
  const bobur = await insertUser(db, 'learner', 'Bobur')
  const group = await groups.create({
    name: 'A1 morning',
    capacity: 12,
    teacherId: teacher,
    createdBy: admin,
  })
  await groups.addLearner(group, aziza, admin)
  const lesson = await repo.create(group, at('2026-11-02T04:00:00Z'))
  return { admin, teacher, other, aziza, bobur, group, lesson }
}

const as = (userId: string, role: 'admin' | 'teacher' | 'learner') => ({
  userId,
  role,
})

describe('create', () => {
  it('makes a scheduled lesson with a closed meeting and a server-made room', async () => {
    const w = await world()
    const record = await repo.findVisible(as(w.admin, 'admin'), w.lesson)
    expect(record).toEqual({
      id: w.lesson,
      groupId: w.group,
      groupName: 'A1 morning',
      teacherId: w.teacher,
      scheduledAt: at('2026-11-02T04:00:00Z'),
      status: 'scheduled',
      createdAt: expect.any(Date),
      openedAt: null,
      closedAt: null,
      livekitRoom: `lesson-${w.lesson}`,
    })
  })

  it('gives every lesson its own room', async () => {
    const w = await world()
    const second = await repo.create(w.group, at('2026-11-03T04:00:00Z'))
    const [a, b] = await Promise.all(
      [w.lesson, second].map((id) =>
        repo.findVisible(as(w.admin, 'admin'), id),
      ),
    )
    expect(a?.livekitRoom).not.toBe(b?.livekitRoom)
  })

  it('leaves nothing behind for a group that does not exist', async () => {
    await world()
    const failure = await repo
      .create(UNKNOWN, at('2026-11-02T04:00:00Z'))
      .catch((error: unknown) => error)
    expect(pgCode(failure)).toBe('23503')
    const [{ lessonRows, meetingRows }] = (
      await db.execute(
        sql`select (select count(*) from lessons)::int as "lessonRows", (select count(*) from meetings)::int as "meetingRows"`,
      )
    ).rows as { lessonRows: number; meetingRows: number }[]
    expect(lessonRows).toBe(1)
    expect(meetingRows).toBe(1)
  })
})

describe('findVisible', () => {
  it('shows a lesson to the admin, the teacher and a member of its group', async () => {
    const w = await world()
    for (const who of [
      as(w.admin, 'admin'),
      as(w.teacher, 'teacher'),
      as(w.aziza, 'learner'),
    ]) {
      expect((await repo.findVisible(who, w.lesson))?.id).toBe(w.lesson)
    }
  })

  it('hides it from other teachers, outsiders and removed learners', async () => {
    const w = await world()
    expect(await repo.findVisible(as(w.other, 'teacher'), w.lesson)).toBeNull()
    expect(await repo.findVisible(as(w.bobur, 'learner'), w.lesson)).toBeNull()
    await groups.removeLearner(w.group, w.aziza)
    expect(await repo.findVisible(as(w.aziza, 'learner'), w.lesson)).toBeNull()
  })

  it('hides it once its group is deleted, even from the admin', async () => {
    const w = await world()
    await groups.softDelete(w.group)
    expect(await repo.findVisible(as(w.admin, 'admin'), w.lesson)).toBeNull()
  })

  it('knows no lesson by an unknown id', async () => {
    const w = await world()
    expect(await repo.findVisible(as(w.admin, 'admin'), UNKNOWN)).toBeNull()
  })
})

describe('listForGroup', () => {
  it('lists the latest lessons first and honours the cap', async () => {
    const w = await world()
    const later = await repo.create(w.group, at('2026-11-09T04:00:00Z'))
    const earlier = await repo.create(w.group, at('2026-10-30T04:00:00Z'))
    const all = await repo.listForGroup(w.group, 10)
    expect(all.map((l) => l.id)).toEqual([later, w.lesson, earlier])
    expect(await repo.listForGroup(w.group, 2)).toHaveLength(2)
  })

  it('lists nothing for a deleted group or for another group', async () => {
    const w = await world()
    const elsewhere = await groups.create({
      name: 'B1',
      capacity: 5,
      teacherId: w.teacher,
      createdBy: w.admin,
    })
    expect(await repo.listForGroup(elsewhere, 10)).toEqual([])
    await groups.softDelete(w.group)
    expect(await repo.listForGroup(w.group, 10)).toEqual([])
  })
})

describe('transition', () => {
  const get = async (w: Awaited<ReturnType<typeof world>>) => {
    const record = await repo.findVisible(as(w.admin, 'admin'), w.lesson)
    if (!record) throw new Error('lesson vanished')
    return record
  }

  it('opens the meeting on start and closes it on end', async () => {
    const w = await world()
    expect(await repo.transition(w.lesson, 'start')).toBe(true)
    const live = await get(w)
    expect(live.status).toBe('live')
    expect(live.openedAt).toBeInstanceOf(Date)
    expect(live.closedAt).toBeNull()

    expect(await repo.transition(w.lesson, 'end')).toBe(true)
    const ended = await get(w)
    expect(ended.status).toBe('ended')
    expect(ended.closedAt).toBeInstanceOf(Date)
    expect(ended.openedAt).toEqual(live.openedAt)
  })

  it('cancels a lesson that has not started and leaves the meeting shut', async () => {
    const w = await world()
    expect(await repo.transition(w.lesson, 'cancel')).toBe(true)
    const cancelled = await get(w)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.openedAt).toBeNull()
    expect(cancelled.closedAt).toBeNull()
  })

  it('refuses every move that is not forward', async () => {
    const w = await world()
    expect(await repo.transition(w.lesson, 'end')).toBe(false)
    await repo.transition(w.lesson, 'start')
    expect(await repo.transition(w.lesson, 'start')).toBe(false)
    expect(await repo.transition(w.lesson, 'cancel')).toBe(false)
    await repo.transition(w.lesson, 'end')
    for (const action of ['start', 'end', 'cancel'] as const) {
      expect(await repo.transition(w.lesson, action)).toBe(false)
    }
    expect((await get(w)).status).toBe('ended')
  })

  it('never reopens a cancelled lesson', async () => {
    const w = await world()
    await repo.transition(w.lesson, 'cancel')
    for (const action of ['start', 'end', 'cancel'] as const) {
      expect(await repo.transition(w.lesson, action)).toBe(false)
    }
    expect((await get(w)).openedAt).toBeNull()
  })

  it('lets only one of several simultaneous starts win', async () => {
    const w = await world()
    const results = await Promise.all(
      Array.from({ length: 6 }, () => repo.transition(w.lesson, 'start')),
    )
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('says false for a lesson that does not exist', async () => {
    await world()
    expect(await repo.transition(UNKNOWN, 'start')).toBe(false)
  })
})
