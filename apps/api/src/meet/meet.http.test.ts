import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  LIVEKIT_TEST_KEY,
  LIVEKIT_TEST_SECRET,
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
let nextLearner = 6000

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

// A group taught by `teacher` with Aziza in it, Bobur outside it, and one
// scheduled lesson.
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
  const lesson = await call('POST', `/api/groups/${groupId}/lessons`, {
    cookie: teacher.cookie,
    body: { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() },
  })
  return { groupId, lessonId: lesson.json.id as string, aziza, bobur }
}

const act = (lessonId: string, action: string) =>
  call('POST', `/api/lessons/${lessonId}/${action}`, { cookie: teacher.cookie })

const token = (who: Person | null, body: unknown) =>
  call('POST', '/api/meet/token', { cookie: who?.cookie, body })

function claimsOf(jwt: string) {
  const [header, payload, signature] = jwt.split('.')
  const signed = createHmac('sha256', LIVEKIT_TEST_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return {
    signatureValid: signed === signature,
    claims: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
  }
}

describe('sign-in is required', () => {
  it('answers 401 without a session and 400 for a bearer token', async () => {
    const w = await world()
    expect((await token(null, { lessonId: w.lessonId })).status).toBe(401)
    const bearer = await call('POST', '/api/meet/token', {
      body: { lessonId: w.lessonId },
      headers: { authorization: `Bearer ${teacher.cookie.split('=')[1]}` },
    })
    expect(bearer.status).toBe(400)
    expect(bearer.json).toEqual({ error: 'cookie_session_required' })
  })
})

describe('asking for a token', () => {
  it.each([
    [undefined],
    [[]],
    [{}],
    [{ lessonId: 5 }],
    [{ lessonId: 'nope' }],
    [{ room: 'lesson-1' }],
    [{ lessonId: ['x'] }],
  ])('refuses the body %j', async (body) => {
    const reply = await token(teacher, body)
    expect(reply.status).toBe(400)
    expect(reply.json).toEqual({ error: 'bad_lesson' })
  })

  it('answers a hidden lesson exactly like a missing one', async () => {
    const w = await world()
    await act(w.lessonId, 'start')
    for (const who of [w.bobur, teacher2]) {
      const hidden = await token(who, { lessonId: w.lessonId })
      expect(hidden.status).toBe(404)
      expect(hidden.json).toEqual({ error: 'not_found' })
    }
    const missing = await token(w.bobur, { lessonId: UNKNOWN })
    expect(missing.status).toBe(404)
    expect(missing.json).toEqual({ error: 'not_found' })
  })

  it('waits for Start and stops at End or Cancel', async () => {
    const w = await world()
    for (const who of [w.aziza, teacher, admin]) {
      const early = await token(who, { lessonId: w.lessonId })
      expect(early.status).toBe(409)
      expect(early.json).toEqual({ error: 'lesson_not_live' })
    }
    await act(w.lessonId, 'start')
    expect((await token(w.aziza, { lessonId: w.lessonId })).status).toBe(200)
    await act(w.lessonId, 'end')
    expect((await token(w.aziza, { lessonId: w.lessonId })).status).toBe(409)

    const cancelled = await world()
    await act(cancelled.lessonId, 'cancel')
    expect(
      (await token(cancelled.aziza, { lessonId: cancelled.lessonId })).status,
    ).toBe(409)
  })
})

describe('the token', () => {
  it('gives a member a signed, two-minute pass to the lesson room only', async () => {
    const w = await world()
    await act(w.lessonId, 'start')
    const reply = await token(w.aziza, { lessonId: w.lessonId })
    expect(reply.status).toBe(200)
    expect(Object.keys(reply.json).sort()).toEqual([
      'expiresInSeconds',
      'token',
    ])
    expect(reply.json.expiresInSeconds).toBe(120)

    const { signatureValid, claims } = claimsOf(reply.json.token)
    expect(signatureValid).toBe(true)
    expect(claims).toEqual({
      iss: LIVEKIT_TEST_KEY,
      sub: w.aziza.userId,
      name: 'Aziza',
      nbf: expect.any(Number),
      exp: claims.nbf + 120,
      video: {
        room: `lesson-${w.lessonId}`,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      },
    })
  })

  it('ignores a room the client names, so a pass opens the lesson room only', async () => {
    const w = await world()
    const elsewhere = await world()
    await act(w.lessonId, 'start')
    await act(elsewhere.lessonId, 'start')
    const reply = await token(w.aziza, {
      lessonId: w.lessonId,
      room: `lesson-${elsewhere.lessonId}`,
    })
    expect(reply.status).toBe(200)
    expect(claimsOf(reply.json.token).claims.video.room).toBe(
      `lesson-${w.lessonId}`,
    )
  })

  it('makes the group teacher and an admin room admins, and nobody else', async () => {
    const w = await world()
    await act(w.lessonId, 'start')
    const adminOf = async (who: Person) =>
      claimsOf((await token(who, { lessonId: w.lessonId })).json.token).claims
        .video.roomAdmin
    expect(await adminOf(teacher)).toBe(true)
    expect(await adminOf(admin)).toBe(true)
    expect(await adminOf(w.aziza)).toBeUndefined()
  })

  it('never contains the session token or the signing secret', async () => {
    const w = await world()
    await act(w.lessonId, 'start')
    const reply = await token(w.aziza, { lessonId: w.lessonId })
    const sid = w.aziza.cookie.split('=')[1]
    const decoded = Buffer.from(reply.json.token.split('.')[1], 'base64url')
    expect(reply.json.token).not.toContain(sid)
    expect(decoded.toString()).not.toContain(sid)
    expect(decoded.toString()).not.toContain(LIVEKIT_TEST_SECRET)
  })

  it('is refused to a learner who left, and for a deleted group', async () => {
    const w = await world()
    await act(w.lessonId, 'start')
    await call('DELETE', `/api/groups/${w.groupId}/members/${w.aziza.userId}`, {
      cookie: admin.cookie,
    })
    expect((await token(w.aziza, { lessonId: w.lessonId })).status).toBe(404)

    const other = await world()
    await act(other.lessonId, 'start')
    await call('DELETE', `/api/groups/${other.groupId}`, {
      cookie: admin.cookie,
    })
    for (const who of [other.aziza, teacher, admin]) {
      expect((await token(who, { lessonId: other.lessonId })).status).toBe(404)
    }
  })
})

describe('without LiveKit credentials', () => {
  it('answers 503 to a member, and still 404 to someone who may not join', async () => {
    const bare = await bootTestApp({
      LIVEKIT_API_KEY: undefined,
      LIVEKIT_API_SECRET: undefined,
    })
    try {
      const bareCall = client(bare.base)
      const bareAdmin = await signInAs(bare.app, TEST_ADMIN, 'Admin')
      const bareTeacher = await signInAs(bare.app, TEST_TEACHER, 'Mukhtasar')
      const outsider = await signInAs(bare.app, '5999', 'Outsider')
      const group = await bareCall('POST', '/api/groups', {
        cookie: bareTeacher.cookie,
        body: { name: 'A1' },
      })
      const lesson = await bareCall(
        'POST',
        `/api/groups/${group.json.id}/lessons`,
        {
          cookie: bareTeacher.cookie,
          body: { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() },
        },
      )
      await bareCall('POST', `/api/lessons/${lesson.json.id}/start`, {
        cookie: bareTeacher.cookie,
      })
      const body = { lessonId: lesson.json.id }
      const configured = await bareCall('POST', '/api/meet/token', {
        cookie: bareAdmin.cookie,
        body,
      })
      expect(configured.status).toBe(503)
      expect(configured.json).toEqual({ error: 'meet_disabled' })
      const stranger = await bareCall('POST', '/api/meet/token', {
        cookie: outsider.cookie,
        body,
      })
      expect(stranger.status).toBe(404)
    } finally {
      await bare.close()
    }
  })

  it('refuses the development key pair in production', async () => {
    const prod = await bootTestApp({
      NODE_ENV: 'production',
      LIVEKIT_API_KEY: 'devkey',
      LIVEKIT_API_SECRET: 'devsecret-local-only-not-for-the-vps',
    })
    try {
      const prodCall = client(prod.base)
      const prodAdmin = await signInAs(prod.app, TEST_ADMIN, 'Admin')
      const prodTeacher = await signInAs(prod.app, TEST_TEACHER, 'Mukhtasar')
      const group = await prodCall('POST', '/api/groups', {
        cookie: prodTeacher.cookie,
        body: { name: 'A1' },
      })
      const lesson = await prodCall(
        'POST',
        `/api/groups/${group.json.id}/lessons`,
        {
          cookie: prodTeacher.cookie,
          body: { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() },
        },
      )
      await prodCall('POST', `/api/lessons/${lesson.json.id}/start`, {
        cookie: prodTeacher.cookie,
      })
      const reply = await prodCall('POST', '/api/meet/token', {
        cookie: prodAdmin.cookie,
        body: { lessonId: lesson.json.id },
      })
      expect(reply.status).toBe(503)
    } finally {
      await prod.close()
    }
  })
})
