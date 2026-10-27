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
const HOUR = 3_600_000

let booted: Booted
let call: ReturnType<typeof client>
let admin: Person
let teacher: Person
let teacher2: Person
let nextLearner = 8000

const learner = (name: string) =>
  signInAs(booted.app, String(nextLearner++), name)
const inHours = (hours: number) =>
  new Date(Date.now() + hours * HOUR).toISOString()

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

// A group taught by `teacher` with Aziza in it, and Bobur outside it.
async function world() {
  const created = await call('POST', '/api/groups', {
    cookie: teacher.cookie,
    body: { name: 'A1 morning' },
  })
  const groupId = created.json.id as string
  const aziza = await learner('Aziza')
  const bobur = await learner('Bobur')
  await call('POST', `/api/groups/${groupId}/members`, {
    cookie: admin.cookie,
    body: { userId: aziza.userId },
  })
  return { groupId, aziza, bobur }
}

const schedule = (groupId: string, who: Person, scheduledAt: unknown) =>
  call('POST', `/api/groups/${groupId}/lessons`, {
    cookie: who.cookie,
    body: { scheduledAt },
  })

async function lessonIn(groupId: string, at = inHours(2)) {
  const reply = await schedule(groupId, teacher, at)
  expect(reply.status).toBe(201)
  return reply.json.id as string
}

const act = (lessonId: string, who: Person, action: string) =>
  call('POST', `/api/lessons/${lessonId}/${action}`, { cookie: who.cookie })

describe('sign-in is required', () => {
  it('answers 401 without a session and 400 for a bearer token', async () => {
    const w = await world()
    const id = await lessonIn(w.groupId)
    const routes: [string, string][] = [
      ['GET', `/api/groups/${w.groupId}/lessons`],
      ['POST', `/api/groups/${w.groupId}/lessons`],
      ['GET', `/api/lessons/${id}`],
      ['POST', `/api/lessons/${id}/start`],
      ['POST', `/api/lessons/${id}/end`],
      ['POST', `/api/lessons/${id}/cancel`],
    ]
    for (const [method, path] of routes) {
      expect((await call(method, path)).status).toBe(401)
      const bearer = await call(method, path, {
        headers: { authorization: `Bearer ${teacher.cookie.split('=')[1]}` },
      })
      expect(bearer.status).toBe(400)
    }
  })
})

describe('scheduling a lesson', () => {
  it('lets the group teacher schedule one and hides the room', async () => {
    const w = await world()
    const at = inHours(26)
    const reply = await schedule(w.groupId, teacher, at)
    expect(reply.status).toBe(201)
    expect(reply.json).toEqual({
      id: expect.any(String),
      groupId: w.groupId,
      groupName: 'A1 morning',
      scheduledAt: at,
      status: 'scheduled',
      createdAt: expect.any(String),
      meeting: { openedAt: null, closedAt: null },
    })
    expect(JSON.stringify(reply.json)).not.toMatch(/livekit|room|teacher/i)
  })

  it('reads a time with an offset as the same instant', async () => {
    const w = await world()
    const instant = new Date(Math.floor((Date.now() + 5 * HOUR) / 1000) * 1000)
    const tashkent = new Date(instant.getTime() + 5 * HOUR)
      .toISOString()
      .replace(/\.\d{3}Z$/, '+05:00')
    const reply = await schedule(w.groupId, teacher, tashkent)
    expect(reply.status).toBe(201)
    expect(reply.json.scheduledAt).toBe(instant.toISOString())
  })

  it('lets an admin schedule for any group', async () => {
    const w = await world()
    expect((await schedule(w.groupId, admin, inHours(3))).status).toBe(201)
  })

  it('refuses a member, and says nothing to someone outside the group', async () => {
    const w = await world()
    const member = await schedule(w.groupId, w.aziza, inHours(3))
    expect(member.status).toBe(403)
    expect(member.json).toEqual({ error: 'forbidden' })
    for (const who of [w.bobur, teacher2]) {
      const reply = await schedule(w.groupId, who, inHours(3))
      expect(reply.status).toBe(404)
      expect(reply.json).toEqual({ error: 'not_found' })
    }
    expect((await schedule(UNKNOWN, teacher, inHours(3))).status).toBe(404)
    expect((await schedule('nope', teacher, inHours(3))).status).toBe(400)
  })

  it('checks authority before it reads the body', async () => {
    const w = await world()
    const reply = await schedule(w.groupId, w.aziza, 'garbage')
    expect(reply.status).toBe(403)
  })

  it.each([
    ['tomorrow'],
    ['2026-10-28T09:00:00'],
    ['2020-01-01T00:00:00Z'],
    ['2099-01-01T00:00:00Z'],
    [undefined],
  ])('refuses the time %j', async (value) => {
    const w = await world()
    const reply = await schedule(w.groupId, teacher, value)
    expect(reply.status).toBe(400)
    expect(reply.json).toEqual({ error: 'bad_time' })
  })
})

describe('reading lessons', () => {
  it('shows a group its lessons, latest first, to members and no one else', async () => {
    const w = await world()
    const later = await lessonIn(w.groupId, inHours(72))
    const sooner = await lessonIn(w.groupId, inHours(24))
    for (const who of [w.aziza, teacher, admin]) {
      const reply = await call('GET', `/api/groups/${w.groupId}/lessons`, {
        cookie: who.cookie,
      })
      expect(reply.status).toBe(200)
      expect(reply.json.lessons.map((l: { id: string }) => l.id)).toEqual([
        later,
        sooner,
      ])
    }
    for (const who of [w.bobur, teacher2]) {
      const reply = await call('GET', `/api/groups/${w.groupId}/lessons`, {
        cookie: who.cookie,
      })
      expect(reply.status).toBe(404)
    }
  })

  it('shows one lesson to the group and hides it from everyone else', async () => {
    const w = await world()
    const id = await lessonIn(w.groupId)
    for (const who of [w.aziza, teacher, admin]) {
      expect(
        (await call('GET', `/api/lessons/${id}`, { cookie: who.cookie }))
          .status,
      ).toBe(200)
    }
    for (const who of [w.bobur, teacher2]) {
      const reply = await call('GET', `/api/lessons/${id}`, {
        cookie: who.cookie,
      })
      expect(reply.status).toBe(404)
      expect(reply.json).toEqual({ error: 'not_found' })
    }
    expect(
      (await call('GET', `/api/lessons/${UNKNOWN}`, { cookie: admin.cookie }))
        .status,
    ).toBe(404)
    expect(
      (await call('GET', '/api/lessons/nope', { cookie: admin.cookie })).status,
    ).toBe(400)
  })

  it('forgets the lessons of a deleted group', async () => {
    const w = await world()
    const id = await lessonIn(w.groupId)
    await call('DELETE', `/api/groups/${w.groupId}`, { cookie: admin.cookie })
    for (const who of [admin, teacher, w.aziza]) {
      expect(
        (await call('GET', `/api/lessons/${id}`, { cookie: who.cookie }))
          .status,
      ).toBe(404)
      expect(
        (
          await call('GET', `/api/groups/${w.groupId}/lessons`, {
            cookie: who.cookie,
          })
        ).status,
      ).toBe(404)
    }
    expect((await act(id, teacher, 'start')).status).toBe(404)
  })
})

describe('running a lesson', () => {
  it('goes scheduled, live, ended and opens and closes the meeting', async () => {
    const w = await world()
    const id = await lessonIn(w.groupId)

    const started = await act(id, teacher, 'start')
    expect(started.status).toBe(200)
    expect(started.json.status).toBe('live')
    expect(started.json.meeting.openedAt).toEqual(expect.any(String))
    expect(started.json.meeting.closedAt).toBeNull()

    const ended = await act(id, teacher, 'end')
    expect(ended.status).toBe(200)
    expect(ended.json.status).toBe('ended')
    expect(ended.json.meeting.openedAt).toBe(started.json.meeting.openedAt)
    expect(ended.json.meeting.closedAt).toEqual(expect.any(String))
  })

  it('refuses every step that is not forward', async () => {
    const w = await world()
    const id = await lessonIn(w.groupId)

    const early = await act(id, teacher, 'end')
    expect(early.status).toBe(409)
    expect(early.json).toEqual({ error: 'lesson_not_live' })

    await act(id, teacher, 'start')
    expect((await act(id, teacher, 'start')).json).toEqual({
      error: 'lesson_not_scheduled',
    })
    expect((await act(id, teacher, 'cancel')).json).toEqual({
      error: 'lesson_not_scheduled',
    })

    await act(id, teacher, 'end')
    for (const action of ['start', 'end', 'cancel']) {
      expect((await act(id, teacher, action)).status).toBe(409)
    }
  })

  it('cancels a lesson that has not started, for good', async () => {
    const w = await world()
    const id = await lessonIn(w.groupId)
    const cancelled = await act(id, teacher, 'cancel')
    expect(cancelled.json.status).toBe('cancelled')
    expect(cancelled.json.meeting).toEqual({ openedAt: null, closedAt: null })
    for (const action of ['start', 'end', 'cancel']) {
      expect((await act(id, teacher, action)).status).toBe(409)
    }
  })

  it('lets only the group teacher or an admin run it', async () => {
    const w = await world()
    const id = await lessonIn(w.groupId)
    for (const action of ['start', 'end', 'cancel']) {
      const member = await act(id, w.aziza, action)
      expect(member.status).toBe(403)
      expect(member.json).toEqual({ error: 'forbidden' })
      for (const outsider of [w.bobur, teacher2]) {
        const reply = await act(id, outsider, action)
        expect(reply.status).toBe(404)
        expect(reply.json).toEqual({ error: 'not_found' })
      }
    }
    expect((await act(id, admin, 'start')).status).toBe(200)
    expect((await act(id, admin, 'end')).status).toBe(200)
  })

  it('lets exactly one of several simultaneous starts through', async () => {
    const w = await world()
    const id = await lessonIn(w.groupId)
    const replies = await Promise.all(
      Array.from({ length: 4 }, () => act(id, teacher, 'start')),
    )
    expect(replies.filter((r) => r.status === 200)).toHaveLength(1)
    expect(replies.filter((r) => r.status === 409)).toHaveLength(3)
  })

  it('refuses a malformed or unknown lesson id', async () => {
    expect((await act('nope', teacher, 'start')).status).toBe(400)
    expect((await act(UNKNOWN, teacher, 'start')).status).toBe(404)
  })
})
