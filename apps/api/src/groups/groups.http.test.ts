import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  TEST_ADMIN,
  TEST_TEACHER,
  TEST_TEACHER_2,
  bootTestApp,
  client,
  signInAs,
} from '../testing/harness'

type Booted = Awaited<ReturnType<typeof bootTestApp>>
type Person = Awaited<ReturnType<typeof signInAs>>

const UNKNOWN = '0192f000-0000-7000-8000-000000000000'

let booted: Booted
let call: ReturnType<typeof client>
let admin: Person
let teacher: Person
let teacher2: Person
let nextLearner = 7000

const learner = (name: string) =>
  signInAs(booted.app, String(nextLearner++), name)

beforeAll(async () => {
  booted = await bootTestApp()
  call = client(booted.base)
  admin = await signInAs(booted.app, TEST_ADMIN, 'Admin')
  teacher = await signInAs(booted.app, TEST_TEACHER, 'Mukhtasar')
  teacher2 = await signInAs(booted.app, TEST_TEACHER_2, 'Dilnoza')
})

afterAll(async () => {
  await booted?.close()
})

const createGroup = async (who: Person, body: Record<string, unknown>) =>
  call('POST', '/api/groups', { cookie: who.cookie, body })

const teachersGroup = async (capacity = 12) => {
  const reply = await createGroup(teacher, { name: 'A1 morning', capacity })
  expect(reply.status).toBe(201)
  return reply.json.id as string
}

const add = (groupId: string, who: Person, userId: string) =>
  call('POST', `/api/groups/${groupId}/members`, {
    cookie: who.cookie,
    body: { userId },
  })

describe('sign-in is required', () => {
  it('answers 401 without a session and 400 for a bearer token', async () => {
    const anonymous = await call('GET', '/api/groups')
    expect(anonymous.status).toBe(401)
    expect(anonymous.json).toEqual({ error: 'unauthorized' })
    expect(
      (await call('POST', '/api/groups', { body: { name: 'x' } })).status,
    ).toBe(401)
    const bearer = await call('GET', '/api/groups', {
      headers: { authorization: `Bearer ${teacher.cookie.split('=')[1]}` },
    })
    expect(bearer.status).toBe(400)
    expect(bearer.json).toEqual({ error: 'cookie_session_required' })
  })
})

describe('creating a group', () => {
  it('lets a teacher create a group they teach', async () => {
    const reply = await createGroup(teacher, { name: '  A1 morning ' })
    expect(reply.status).toBe(201)
    expect(reply.json).toEqual({
      id: expect.any(String),
      name: 'A1 morning',
      capacity: 12,
      teacher: { id: teacher.userId, name: 'Mukhtasar' },
      memberCount: 0,
      members: [],
      createdAt: expect.any(String),
    })
  })

  it('lets an admin create a group for a named teacher', async () => {
    const reply = await createGroup(admin, {
      name: 'B1 evening',
      capacity: 3,
      teacherId: teacher2.userId,
    })
    expect(reply.status).toBe(201)
    expect(reply.json.teacher).toEqual({ id: teacher2.userId, name: 'Dilnoza' })
    expect(reply.json.capacity).toBe(3)
  })

  it('refuses a learner before it reads the body', async () => {
    const aziza = await learner('Aziza')
    for (const body of [{ name: 'x' }, {}, { name: 'x', capacity: 99 }]) {
      const reply = await createGroup(aziza, body)
      expect(reply.status).toBe(403)
      expect(reply.json).toEqual({ error: 'forbidden' })
    }
  })

  it('stops a teacher naming another teacher', async () => {
    const reply = await createGroup(teacher, {
      name: 'x',
      teacherId: teacher2.userId,
    })
    expect(reply.status).toBe(403)
    expect(reply.json).toEqual({ error: 'forbidden' })
  })

  it('asks an admin for a teacher, and refuses a learner as the teacher', async () => {
    const aziza = await learner('Aziza')
    const missing = await createGroup(admin, { name: 'x' })
    expect(missing.status).toBe(400)
    expect(missing.json).toEqual({ error: 'bad_teacher' })
    const notATeacher = await createGroup(admin, {
      name: 'x',
      teacherId: aziza.userId,
    })
    expect(notATeacher.json).toEqual({ error: 'bad_teacher' })
    const unknown = await createGroup(admin, { name: 'x', teacherId: UNKNOWN })
    expect(unknown.json).toEqual({ error: 'bad_teacher' })
  })

  it('validates the body', async () => {
    expect((await createGroup(teacher, {})).json).toEqual({ error: 'bad_name' })
    expect(
      (await createGroup(teacher, { name: 'x', capacity: 13 })).json,
    ).toEqual({ error: 'bad_capacity' })
  })
})

describe('who sees a group', () => {
  it('lists a teacher their groups, a learner theirs, and nobody else the rest', async () => {
    const id = await teachersGroup()
    const aziza = await learner('Aziza')
    const bobur = await learner('Bobur')
    expect((await add(id, admin, aziza.userId)).status).toBe(201)

    const idsFor = async (who: Person) =>
      (
        await call('GET', '/api/groups', { cookie: who.cookie })
      ).json.groups.map((g: { id: string }) => g.id)
    expect(await idsFor(admin)).toContain(id)
    expect(await idsFor(teacher)).toContain(id)
    expect(await idsFor(aziza)).toEqual([id])
    expect(await idsFor(bobur)).toEqual([])
    expect(await idsFor(teacher2)).not.toContain(id)
  })

  it('shows the roster to the teacher and admin, only a count to a learner', async () => {
    const id = await teachersGroup()
    const aziza = await learner('Aziza')
    await add(id, admin, aziza.userId)

    const asTeacher = await call('GET', `/api/groups/${id}`, {
      cookie: teacher.cookie,
    })
    expect(asTeacher.json.members).toEqual([
      { userId: aziza.userId, name: 'Aziza', addedAt: expect.any(String) },
    ])
    const asAdmin = await call('GET', `/api/groups/${id}`, {
      cookie: admin.cookie,
    })
    expect(asAdmin.json.members).toHaveLength(1)

    const asLearner = await call('GET', `/api/groups/${id}`, {
      cookie: aziza.cookie,
    })
    expect(asLearner.status).toBe(200)
    expect(asLearner.json.memberCount).toBe(1)
    expect(asLearner.json).not.toHaveProperty('members')
    expect(
      JSON.stringify([asTeacher.json, asAdmin.json, asLearner.json]),
    ).not.toMatch(/telegram/i)
  })

  it('answers the same 404 for a group that is hidden, missing or deleted', async () => {
    const id = await teachersGroup()
    const outsider = await learner('Outsider')
    const hidden = await call('GET', `/api/groups/${id}`, {
      cookie: outsider.cookie,
    })
    const otherTeacher = await call('GET', `/api/groups/${id}`, {
      cookie: teacher2.cookie,
    })
    const missing = await call('GET', `/api/groups/${UNKNOWN}`, {
      cookie: outsider.cookie,
    })
    for (const reply of [hidden, otherTeacher, missing]) {
      expect(reply.status).toBe(404)
      expect(reply.json).toEqual({ error: 'not_found' })
    }
  })

  it('refuses a malformed id before querying', async () => {
    const reply = await call('GET', '/api/groups/not-a-uuid', {
      cookie: admin.cookie,
    })
    expect(reply.status).toBe(400)
    expect(reply.json).toEqual({ error: 'bad_id' })
  })
})

describe('membership', () => {
  it('belongs to the admin alone', async () => {
    const id = await teachersGroup()
    const aziza = await learner('Aziza')
    for (const who of [teacher, teacher2, aziza]) {
      const reply = await add(id, who, aziza.userId)
      expect(reply.status).toBe(403)
      expect(reply.json).toEqual({ error: 'forbidden' })
    }
    expect((await add(id, admin, aziza.userId)).status).toBe(201)
    for (const who of [teacher, aziza]) {
      const reply = await call(
        'DELETE',
        `/api/groups/${id}/members/${aziza.userId}`,
        { cookie: who.cookie },
      )
      expect(reply.status).toBe(403)
    }
  })

  it('answers 403 to a non-admin even for a group that does not exist', async () => {
    const aziza = await learner('Aziza')
    expect((await add(UNKNOWN, aziza, aziza.userId)).status).toBe(403)
    expect((await add('nope', aziza, aziza.userId)).status).toBe(403)
  })

  it('returns the roster once a learner is added', async () => {
    const id = await teachersGroup()
    const aziza = await learner('Aziza')
    const reply = await add(id, admin, aziza.userId)
    expect(reply.json.memberCount).toBe(1)
    expect(reply.json.members.map((m: { name: string }) => m.name)).toEqual([
      'Aziza',
    ])
  })

  it('keeps to the capacity, frees a seat on removal, and refuses duplicates', async () => {
    const id = await teachersGroup(1)
    const aziza = await learner('Aziza')
    const bobur = await learner('Bobur')
    expect((await add(id, admin, aziza.userId)).status).toBe(201)

    const dup = await add(id, admin, aziza.userId)
    expect(dup.status).toBe(409)
    expect(dup.json).toEqual({ error: 'already_member' })

    const full = await add(id, admin, bobur.userId)
    expect(full.status).toBe(409)
    expect(full.json).toEqual({ error: 'group_full' })

    const removed = await call(
      'DELETE',
      `/api/groups/${id}/members/${aziza.userId}`,
      { cookie: admin.cookie },
    )
    expect(removed.status).toBe(204)
    expect(
      (await call('GET', `/api/groups/${id}`, { cookie: aziza.cookie })).status,
    ).toBe(404)
    expect((await add(id, admin, bobur.userId)).status).toBe(201)
  })

  it('holds a full house of twelve under parallel adds', async () => {
    const id = await teachersGroup(12)
    const crowd = await Promise.all(
      Array.from({ length: 15 }, (_, i) => learner(`Crowd ${i}`)),
    )
    const replies = await Promise.all(
      crowd.map((person) => add(id, admin, person.userId)),
    )
    expect(replies.filter((r) => r.status === 201)).toHaveLength(12)
    expect(replies.filter((r) => r.status === 409)).toHaveLength(3)
  })

  it('only adds a learner the system knows', async () => {
    const id = await teachersGroup()
    const bad = [teacher.userId, admin.userId, UNKNOWN, 'nope']
    for (const userId of bad) {
      const reply = await add(id, admin, userId)
      expect(reply.status).toBe(400)
      expect(reply.json).toEqual({ error: 'bad_user' })
    }
    const unknownGroup = await add(UNKNOWN, admin, (await learner('A')).userId)
    expect(unknownGroup.status).toBe(404)
  })

  it('answers 404 when removing someone who is not a member', async () => {
    const id = await teachersGroup()
    const aziza = await learner('Aziza')
    const reply = await call(
      'DELETE',
      `/api/groups/${id}/members/${aziza.userId}`,
      { cookie: admin.cookie },
    )
    expect(reply.status).toBe(404)
  })
})

describe('deleting a group', () => {
  it('is admin-only, answers 403 before looking at the id, and hides the group', async () => {
    const id = await teachersGroup()
    const aziza = await learner('Aziza')
    await add(id, admin, aziza.userId)

    for (const target of [id, UNKNOWN]) {
      const reply = await call('DELETE', `/api/groups/${target}`, {
        cookie: teacher.cookie,
      })
      expect(reply.status).toBe(403)
    }
    expect(
      (await call('DELETE', `/api/groups/${id}`, { cookie: admin.cookie }))
        .status,
    ).toBe(204)

    for (const who of [admin, teacher, aziza]) {
      expect(
        (await call('GET', `/api/groups/${id}`, { cookie: who.cookie })).status,
      ).toBe(404)
    }
    const listed = await call('GET', '/api/groups', { cookie: admin.cookie })
    expect(listed.json.groups.map((g: { id: string }) => g.id)).not.toContain(
      id,
    )
    expect(
      (await call('DELETE', `/api/groups/${id}`, { cookie: admin.cookie }))
        .status,
    ).toBe(404)
  })
})
