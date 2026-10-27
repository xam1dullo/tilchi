import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type TestDb, createTestDb, resetTestDb } from '../db/testing'
import { insertUser, softDeleteUser } from '../testing/people'
import { GroupsRepository } from './groups.repository'

let db: TestDb
let repo: GroupsRepository

beforeAll(async () => {
  db = await createTestDb()
  repo = new GroupsRepository(db)
})

afterAll(async () => {
  await db.$client.close()
})

beforeEach(async () => {
  await resetTestDb(db)
})

async function world() {
  const admin = await insertUser(db, 'admin', 'Admin')
  const teacher = await insertUser(db, 'teacher', 'Mukhtasar')
  const otherTeacher = await insertUser(db, 'teacher', 'Dilnoza')
  const aziza = await insertUser(db, 'learner', 'Aziza')
  const bobur = await insertUser(db, 'learner', 'Bobur')
  const group = await repo.create({
    name: 'A1 morning',
    capacity: 2,
    teacherId: teacher,
    createdBy: admin,
  })
  return { admin, teacher, otherTeacher, aziza, bobur, group }
}

const as = (userId: string, role: 'admin' | 'teacher' | 'learner') => ({
  userId,
  role,
})

describe('create and read', () => {
  it('stores a group with its teacher and an empty roll', async () => {
    const w = await world()
    expect(await repo.findVisible(as(w.admin, 'admin'), w.group)).toEqual({
      id: w.group,
      name: 'A1 morning',
      capacity: 2,
      teacher: { id: w.teacher, name: 'Mukhtasar' },
      memberCount: 0,
      createdAt: expect.any(Date),
    })
  })

  it('counts the learners of each group separately', async () => {
    const w = await world()
    const other = await repo.create({
      name: 'B1',
      capacity: 5,
      teacherId: w.teacher,
      createdBy: w.admin,
    })
    await repo.addLearner(w.group, w.aziza, w.admin)
    await repo.addLearner(other, w.aziza, w.admin)
    await repo.addLearner(other, w.bobur, w.admin)
    const listed = await repo.listVisible(as(w.admin, 'admin'), 50)
    expect(
      Object.fromEntries(listed.map((g) => [g.id, g.memberCount])),
    ).toEqual({ [w.group]: 1, [other]: 2 })
  })

  it('knows who may teach: an active teacher or admin only', async () => {
    const w = await world()
    expect(await repo.teacherCandidate(w.teacher)).toBe(true)
    expect(await repo.teacherCandidate(w.admin)).toBe(true)
    expect(await repo.teacherCandidate(w.aziza)).toBe(false)
    expect(
      await repo.teacherCandidate('0192f000-0000-7000-8000-000000000000'),
    ).toBe(false)
    await softDeleteUser(db, w.otherTeacher)
    expect(await repo.teacherCandidate(w.otherTeacher)).toBe(false)
  })
})

describe('who can see a group', () => {
  it('shows an admin everything, a teacher their own, a learner their own', async () => {
    const w = await world()
    await repo.addLearner(w.group, w.aziza, w.admin)
    const ids = async (userId: string, role: 'admin' | 'teacher' | 'learner') =>
      (await repo.listVisible(as(userId, role), 50)).map((g) => g.id)

    expect(await ids(w.admin, 'admin')).toEqual([w.group])
    expect(await ids(w.teacher, 'teacher')).toEqual([w.group])
    expect(await ids(w.otherTeacher, 'teacher')).toEqual([])
    expect(await ids(w.aziza, 'learner')).toEqual([w.group])
    expect(await ids(w.bobur, 'learner')).toEqual([])
  })

  it('answers null for a group the caller cannot see', async () => {
    const w = await world()
    expect(await repo.findVisible(as(w.bobur, 'learner'), w.group)).toBeNull()
    expect(
      await repo.findVisible(as(w.otherTeacher, 'teacher'), w.group),
    ).toBeNull()
  })

  it('stops showing a group to a learner who was removed', async () => {
    const w = await world()
    await repo.addLearner(w.group, w.aziza, w.admin)
    await repo.removeLearner(w.group, w.aziza)
    expect(await repo.listVisible(as(w.aziza, 'learner'), 50)).toEqual([])
  })

  it('hides a deleted group from everyone, admins included', async () => {
    const w = await world()
    expect(await repo.softDelete(w.group)).toBe(true)
    expect(await repo.listVisible(as(w.admin, 'admin'), 50)).toEqual([])
    expect(await repo.findVisible(as(w.admin, 'admin'), w.group)).toBeNull()
    expect(await repo.softDelete(w.group)).toBe(false)
  })

  it('caps the list', async () => {
    const w = await world()
    await repo.create({
      name: 'B1',
      capacity: 5,
      teacherId: w.teacher,
      createdBy: w.admin,
    })
    expect(await repo.listVisible(as(w.admin, 'admin'), 1)).toHaveLength(1)
  })
})

describe('addLearner', () => {
  it('adds a learner and counts them', async () => {
    const w = await world()
    expect(await repo.addLearner(w.group, w.aziza, w.admin)).toBe('added')
    const group = await repo.findVisible(as(w.admin, 'admin'), w.group)
    expect(group?.memberCount).toBe(1)
  })

  it('refuses a second add of the same learner', async () => {
    const w = await world()
    await repo.addLearner(w.group, w.aziza, w.admin)
    expect(await repo.addLearner(w.group, w.aziza, w.admin)).toBe(
      'already_member',
    )
  })

  it('refuses a learner past capacity', async () => {
    const w = await world()
    const third = await insertUser(db, 'learner', 'Camila')
    await repo.addLearner(w.group, w.aziza, w.admin)
    await repo.addLearner(w.group, w.bobur, w.admin)
    expect(await repo.addLearner(w.group, third, w.admin)).toBe('full')
  })

  it('lets exactly capacity learners in when adds race', async () => {
    const w = await world()
    const crowd = await Promise.all(
      Array.from({ length: 8 }, (_, i) => insertUser(db, 'learner', `L${i}`)),
    )
    const group = await repo.create({
      name: 'Race',
      capacity: 3,
      teacherId: w.teacher,
      createdBy: w.admin,
    })
    const outcomes = await Promise.all(
      crowd.map((id) => repo.addLearner(group, id, w.admin)),
    )
    expect(outcomes.filter((o) => o === 'added')).toHaveLength(3)
    expect(outcomes.filter((o) => o === 'full')).toHaveLength(5)
  })

  it('takes a removed learner back without counting them twice', async () => {
    const w = await world()
    await repo.addLearner(w.group, w.aziza, w.admin)
    await repo.removeLearner(w.group, w.aziza)
    expect(await repo.addLearner(w.group, w.aziza, w.otherTeacher)).toBe(
      'added',
    )
    const group = await repo.findVisible(as(w.admin, 'admin'), w.group)
    expect(group?.memberCount).toBe(1)
  })

  it('frees the seat when a learner leaves', async () => {
    const w = await world()
    const third = await insertUser(db, 'learner', 'Camila')
    await repo.addLearner(w.group, w.aziza, w.admin)
    await repo.addLearner(w.group, w.bobur, w.admin)
    await repo.removeLearner(w.group, w.aziza)
    const admin = as(w.admin, 'admin')
    expect((await repo.findVisible(admin, w.group))?.memberCount).toBe(1)
    expect(await repo.addLearner(w.group, third, w.admin)).toBe('added')
    expect((await repo.findVisible(admin, w.group))?.memberCount).toBe(2)
  })

  it('only adds an active learner to an existing group', async () => {
    const w = await world()
    expect(await repo.addLearner(w.group, w.teacher, w.admin)).toBe(
      'no_learner',
    )
    expect(await repo.addLearner(w.group, w.admin, w.admin)).toBe('no_learner')
    await softDeleteUser(db, w.bobur)
    expect(await repo.addLearner(w.group, w.bobur, w.admin)).toBe('no_learner')
    expect(
      await repo.addLearner(
        w.group,
        '0192f000-0000-7000-8000-000000000000',
        w.admin,
      ),
    ).toBe('no_learner')
    expect(
      await repo.addLearner(
        '0192f000-0000-7000-8000-000000000000',
        w.aziza,
        w.admin,
      ),
    ).toBe('no_group')
    await repo.softDelete(w.group)
    expect(await repo.addLearner(w.group, w.aziza, w.admin)).toBe('no_group')
  })
})

describe('removeLearner', () => {
  it('removes once, then says the learner is not a member', async () => {
    const w = await world()
    await repo.addLearner(w.group, w.aziza, w.admin)
    expect(await repo.removeLearner(w.group, w.aziza)).toBe('removed')
    expect(await repo.removeLearner(w.group, w.aziza)).toBe('not_member')
    expect(await repo.removeLearner(w.group, w.bobur)).toBe('not_member')
  })

  it('says no_group for an unknown or deleted group', async () => {
    const w = await world()
    expect(
      await repo.removeLearner('0192f000-0000-7000-8000-000000000000', w.aziza),
    ).toBe('no_group')
    await repo.softDelete(w.group)
    expect(await repo.removeLearner(w.group, w.aziza)).toBe('no_group')
  })
})

describe('listMembers', () => {
  it('lists active learners by when they joined, names only', async () => {
    const w = await world()
    await repo.addLearner(w.group, w.bobur, w.admin)
    await repo.addLearner(w.group, w.aziza, w.admin)
    const members = await repo.listMembers(w.group)
    expect(members.map((m) => m.name)).toEqual(['Bobur', 'Aziza'])
    expect(Object.keys(members[0]).sort()).toEqual([
      'addedAt',
      'name',
      'userId',
    ])
    await repo.removeLearner(w.group, w.bobur)
    expect((await repo.listMembers(w.group)).map((m) => m.name)).toEqual([
      'Aziza',
    ])
  })
})
