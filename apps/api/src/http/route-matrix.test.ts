import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../app.module'
import { PUBLIC } from './actor'
import { AuthService } from '../auth/auth.service'
import { Database } from '../db/database'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import { LessonsRepository } from '../lessons/lessons.repository'
import { NotificationsRepository } from '../outbox/notifications.repository'
import { RoomAdmin } from '../meet/room-admin'
import { KV, createMemoryKv } from '../redis/kv'
import { createTestDatabase, hasTestDatabase } from '../test/postgres'
import type { TestDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'

type Who = 'anonymous' | 'member' | 'nonMember' | 'owner' | 'other' | 'admin'
const WHO: Who[] = [
  'anonymous',
  'member',
  'nonMember',
  'owner',
  'other',
  'admin',
]
const ROLE = {
  member: 'learner',
  nonMember: 'learner',
  owner: 'teacher',
  other: 'teacher',
  admin: 'admin',
} as const

type Ctx = {
  group: string
  lesson: string
  target: string
  teacher: string
  notification: string
  course: string
  question: string
  test: string
  attempt: string
  speaking: string
}

/** A deadline a week out, within the one-year limit. */
const soon = () => new Date(Date.now() + 7 * 24 * 3_600_000).toISOString()

type Json = {
  id: string
  assignments: { assignmentId: string; attemptId: string }[]
}

/** What a row needs to exist before it is called; built fresh per caller. */
type Assess = 'draft' | 'published' | 'test' | 'attempt' | 'submitted' | 'audio'

/** Expected status per caller, in the order of WHO. */
type Row = {
  name: string
  handler: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  course?: boolean
  assess?: Assess
  /** Lesson state the route needs; a fresh lesson is made per request. */
  lesson?: 'scheduled' | 'live'
  path: (ctx: Ctx) => string
  body?: (ctx: Ctx) => unknown
  expect: [number, number, number, number, number, number]
}

const ROWS: Row[] = [
  {
    name: 'manage courses',
    handler: 'CoursesController.manage',
    method: 'GET',
    path: () => '/api/courses/manage',
    expect: [401, 403, 403, 403, 403, 200],
  },
  {
    name: 'create course',
    handler: 'CoursesController.create',
    method: 'POST',
    path: () => '/api/courses',
    body: () => ({
      title: 'Course',
      description: 'Description',
      segment: 'kattalar',
      level: 'boshlovchi',
    }),
    expect: [401, 403, 403, 403, 403, 201],
  },
  {
    name: 'update course',
    handler: 'CoursesController.update',
    method: 'PATCH',
    course: true,
    path: (c) => `/api/courses/${c.course}`,
    body: () => ({ published: true }),
    expect: [401, 403, 403, 403, 403, 200],
  },
  {
    name: 'delete course',
    handler: 'CoursesController.remove',
    method: 'DELETE',
    course: true,
    path: (c) => `/api/courses/${c.course}`,
    expect: [401, 403, 403, 403, 403, 200],
  },
  {
    name: 'list questions',
    handler: 'QuestionsController.list',
    method: 'GET',
    path: () => '/api/questions',
    expect: [401, 403, 403, 200, 200, 200],
  },
  {
    name: 'create question',
    handler: 'QuestionsController.create',
    method: 'POST',
    path: () => '/api/questions',
    body: () => ({ type: 'speaking', prompt: 'Describe your day' }),
    expect: [401, 403, 403, 201, 201, 201],
  },
  {
    name: 'update question',
    handler: 'QuestionsController.update',
    method: 'PATCH',
    assess: 'draft',
    path: (c) => `/api/questions/${c.question}`,
    body: () => ({ prompt: 'New prompt' }),
    expect: [401, 403, 403, 200, 200, 200],
  },
  {
    name: 'delete question',
    handler: 'QuestionsController.remove',
    method: 'DELETE',
    assess: 'draft',
    path: (c) => `/api/questions/${c.question}`,
    expect: [401, 403, 403, 200, 200, 200],
  },
  {
    name: 'list tests',
    handler: 'TestsController.list',
    method: 'GET',
    path: () => '/api/tests',
    expect: [401, 403, 403, 200, 200, 200],
  },
  {
    name: 'create test',
    handler: 'TestsController.create',
    method: 'POST',
    assess: 'published',
    path: () => '/api/tests',
    body: (c) => ({ title: 'T', questionIds: [c.question] }),
    expect: [401, 403, 403, 201, 201, 201],
  },
  {
    name: 'get test',
    handler: 'TestsController.get',
    method: 'GET',
    assess: 'test',
    path: (c) => `/api/tests/${c.test}`,
    expect: [401, 403, 403, 200, 200, 200],
  },
  {
    name: 'assign test',
    handler: 'AssignmentsController.assign',
    method: 'POST',
    assess: 'test',
    path: (c) => `/api/groups/${c.group}/assignments`,
    body: (c) => ({ testId: c.test, deadline: soon() }),
    expect: [401, 403, 404, 201, 404, 201],
  },
  {
    name: 'list group assignments',
    handler: 'AssignmentsController.listForGroup',
    method: 'GET',
    path: (c) => `/api/groups/${c.group}/assignments`,
    expect: [401, 403, 404, 200, 404, 200],
  },
  {
    name: 'my assignments',
    handler: 'AssignmentsController.mine',
    method: 'GET',
    path: () => '/api/me/assignments',
    expect: [401, 200, 200, 403, 403, 403],
  },
  {
    name: 'get attempt',
    handler: 'AttemptsController.get',
    method: 'GET',
    assess: 'attempt',
    path: (c) => `/api/attempts/${c.attempt}`,
    expect: [401, 200, 404, 200, 404, 200],
  },
  {
    name: 'submit attempt',
    handler: 'AttemptsController.submit',
    method: 'POST',
    assess: 'attempt',
    path: (c) => `/api/attempts/${c.attempt}/submit`,
    body: () => ({ answers: {} }),
    expect: [401, 201, 404, 404, 404, 404],
  },
  {
    name: 'presign audio',
    handler: 'AttemptsController.presign',
    method: 'POST',
    assess: 'attempt',
    path: (c) => `/api/attempts/${c.attempt}/audio/presign`,
    body: (c) => ({
      questionId: c.speaking,
      contentType: 'audio/webm',
      size: 10,
    }),
    expect: [401, 201, 404, 404, 404, 404],
  },
  {
    name: 'play audio',
    handler: 'AttemptsController.playback',
    method: 'GET',
    assess: 'audio',
    path: (c) => `/api/attempts/${c.attempt}/audio/${c.speaking}`,
    expect: [401, 200, 404, 200, 404, 200],
  },
  {
    name: 'grade attempt',
    handler: 'AttemptsController.grade',
    method: 'POST',
    assess: 'submitted',
    path: (c) => `/api/attempts/${c.attempt}/grade`,
    body: () => ({}),
    expect: [401, 403, 404, 201, 404, 201],
  },
  {
    name: 'list groups',
    handler: 'GroupsController.list',
    method: 'GET',
    path: () => '/api/groups',
    expect: [401, 200, 200, 200, 200, 200],
  },
  {
    name: 'create group',
    handler: 'GroupsController.create',
    method: 'POST',
    path: () => '/api/groups',
    body: (c) => ({ name: 'New', teacherId: c.teacher }),
    expect: [401, 403, 403, 201, 201, 201],
  },
  {
    name: 'list teachers',
    handler: 'TeachersController.list',
    method: 'GET',
    path: () => '/api/teachers',
    expect: [401, 403, 403, 403, 403, 200],
  },
  {
    name: 'search learners',
    handler: 'UsersController.search',
    method: 'GET',
    path: () => '/api/users?q=ta',
    expect: [401, 403, 403, 403, 403, 200],
  },
  {
    name: 'record guardian consent',
    handler: 'UsersController.guardianConsent',
    method: 'POST',
    path: (c) => `/api/users/${c.target}/guardian-consent`,
    body: () => ({ by: 'Mother' }),
    expect: [401, 403, 403, 403, 403, 201],
  },
  {
    name: 'list group members',
    handler: 'GroupsController.members',
    method: 'GET',
    path: (c) => `/api/groups/${c.group}/members`,
    expect: [401, 403, 404, 200, 404, 200],
  },
  {
    name: 'get group',
    handler: 'GroupsController.get',
    method: 'GET',
    path: (c) => `/api/groups/${c.group}`,
    expect: [401, 200, 404, 200, 404, 200],
  },
  {
    name: 'add member',
    handler: 'GroupsController.addMember',
    method: 'POST',
    path: (c) => `/api/groups/${c.group}/members`,
    body: (c) => ({ userId: c.target }),
    expect: [401, 403, 403, 403, 403, 201],
  },
  {
    name: 'list lessons',
    handler: 'LessonsController.list',
    method: 'GET',
    path: (c) => `/api/groups/${c.group}/lessons`,
    expect: [401, 200, 404, 200, 404, 200],
  },
  {
    name: 'create lesson',
    handler: 'LessonsController.create',
    method: 'POST',
    path: (c) => `/api/groups/${c.group}/lessons`,
    body: () => ({ scheduledAt: '2030-01-01T10:00:00Z' }),
    expect: [401, 403, 404, 201, 404, 201],
  },
  {
    name: 'get lesson',
    handler: 'LessonsController.get',
    method: 'GET',
    lesson: 'scheduled',
    path: (c) => `/api/lessons/${c.lesson}`,
    expect: [401, 200, 404, 200, 404, 200],
  },
  {
    name: 'start lesson',
    handler: 'LessonsController.start',
    method: 'POST',
    lesson: 'scheduled',
    path: (c) => `/api/lessons/${c.lesson}/start`,
    expect: [401, 403, 404, 201, 404, 201],
  },
  {
    name: 'end lesson',
    handler: 'LessonsController.end',
    method: 'POST',
    lesson: 'live',
    path: (c) => `/api/lessons/${c.lesson}/end`,
    expect: [401, 403, 404, 201, 404, 201],
  },
  {
    name: 'cancel lesson',
    handler: 'LessonsController.cancel',
    method: 'POST',
    lesson: 'scheduled',
    path: (c) => `/api/lessons/${c.lesson}/cancel`,
    expect: [401, 403, 404, 201, 404, 201],
  },
  {
    name: 'reschedule lesson',
    handler: 'LessonsController.reschedule',
    method: 'POST',
    lesson: 'scheduled',
    path: (c) => `/api/lessons/${c.lesson}/reschedule`,
    body: () => ({ scheduledAt: '2030-02-02T10:00:00Z' }),
    expect: [401, 403, 404, 201, 404, 201],
  },
  {
    name: 'join meeting',
    handler: 'MeetController.livekitToken',
    method: 'POST',
    lesson: 'live',
    path: (c) => `/api/meet/lessons/${c.lesson}/token`,
    expect: [401, 201, 404, 201, 404, 201],
  },
  {
    name: 'mute participant',
    handler: 'MeetController.moderate',
    method: 'POST',
    lesson: 'live',
    path: (c) => `/api/meet/lessons/${c.lesson}/participants/${c.target}/mute`,
    expect: [401, 403, 404, 200, 404, 200],
  },
  {
    name: 'remove participant',
    handler: 'MeetController.moderate',
    method: 'POST',
    lesson: 'live',
    path: (c) =>
      `/api/meet/lessons/${c.lesson}/participants/${c.target}/remove`,
    expect: [401, 403, 404, 200, 404, 200],
  },
  {
    name: 'list notifications',
    handler: 'NotificationsController.list',
    method: 'GET',
    path: () => '/api/notifications',
    expect: [401, 200, 200, 200, 200, 200],
  },
  {
    name: 'read notification',
    handler: 'NotificationsController.read',
    method: 'POST',
    path: (c) => `/api/notifications/${c.notification}/read`,
    expect: [401, 201, 404, 404, 404, 404],
  },
  {
    name: 'meet ticket',
    handler: 'MeetController.ticket',
    method: 'POST',
    path: () => '/api/meet/ticket',
    expect: [401, 201, 201, 201, 201, 201],
  },
]

describe('route coverage', () => {
  const handlers = (
    controllers: { name: string; prototype: Record<string, object> }[],
  ) =>
    controllers.flatMap((controller) =>
      Object.getOwnPropertyNames(controller.prototype)
        .filter((name) => name !== 'constructor')
        .map((name) => ({
          id: `${controller.name}.${name}`,
          isPublic: Boolean(
            Reflect.getMetadata(PUBLIC, controller) ||
              Reflect.getMetadata(PUBLIC, controller.prototype[name]),
          ),
        })),
    )

  it('every route is public on purpose or has a row in the matrix', () => {
    const all = handlers(Reflect.getMetadata('controllers', AppModule))
    const guarded = all.filter((h) => !h.isPublic).map((h) => h.id)
    expect(new Set(guarded)).toEqual(new Set(ROWS.map((row) => row.handler)))
    expect(
      all
        .filter((h) => h.isPublic)
        .map((h) => h.id)
        .sort(),
    ).toEqual([
      'AuthController.confirm',
      'AuthController.logout',
      'AuthController.miniapp',
      'AuthController.session',
      'AuthController.start',
      'BotController.register',
      'BotController.webhook',
      'CoursesController.list',
      'DemoController.preview',
      'HealthController.apiHealth',
      'HealthController.health',
      'HealthController.publicConfig',
      'LivekitWebhookController.receive',
    ])
  })
})

describe.skipIf(!hasTestDatabase)('route x role matrix', () => {
  let db: TestDatabase
  let app: INestApplication
  let base: string
  let lessons: LessonsRepository
  let groups: GroupsService
  let inbox: NotificationsRepository
  const ids = {} as Record<keyof typeof ROLE | 'target', string>
  let group = ''

  beforeAll(async () => {
    process.env.LIVEKIT_API_KEY = 'devkey'
    process.env.LIVEKIT_API_SECRET = 'a-secret-that-is-long-enough-for-hs256'
    db = await createTestDatabase()
    const actors = new Map<string, unknown>()
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Database)
      // The test database owns the pool; closing the app must not end it twice.
      .useValue(
        Object.create(db.database, {
          onApplicationShutdown: { value: async () => {} },
        }),
      )
      .overrideProvider(KV)
      .useValue(createMemoryKv())
      .overrideProvider(AuthService)
      .useValue({
        read: async (token: string | undefined) =>
          actors.get(token ?? '') ?? null,
      })
      .overrideProvider(RoomAdmin)
      .useValue({
        close: async () => {},
        mute: async () => {},
        remove: async () => {},
      })
      .compile()
    app = ref.createNestApplication()
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()
    const users = ref.get(UsersRepository)
    lessons = ref.get(LessonsRepository)
    groups = ref.get(GroupsService)
    inbox = ref.get(NotificationsRepository)
    for (const who of Object.keys(ROLE) as (keyof typeof ROLE)[]) {
      const user = await users.ensure({
        id: uuidv7(),
        role: ROLE[who],
        name: who,
      })
      ids[who] = user.id
      actors.set(who, { userId: user.id, role: ROLE[who], name: who })
    }
    ids.target = (
      await users.ensure({ id: uuidv7(), role: 'learner', name: 't' })
    ).id
  })

  afterAll(async () => {
    await app?.close()
    await db?.drop()
  })

  beforeEach(async () => {
    group = (
      await groups.create({
        name: 'G',
        actor: { userId: ids.owner, role: 'teacher', name: 'owner' },
      })
    ).id
    await groups.putMember(group, ids.member)
  })

  async function freshLesson(state: 'scheduled' | 'live') {
    const id = uuidv7()
    await lessons.insert({
      id,
      groupId: group,
      scheduledAt: new Date('2030-01-01'),
    })
    if (state === 'live') await lessons.start(id, new Date())
    return id
  }

  async function freshNotification() {
    await inbox.add({
      outboxId: null,
      userId: ids.member,
      event: 'lesson.scheduled',
      title: 't',
      body: 'b',
      link: null,
    })
    const [mine] = (await inbox.listFor(ids.member)).notifications
    return mine.id
  }

  async function freshCourse() {
    const response = await fetch(`${base}/api/courses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: '__Host-tilchi_sid=admin',
      },
      body: JSON.stringify({
        title: 'Course',
        description: 'Description',
        segment: 'kattalar',
        level: 'boshlovchi',
      }),
    })
    expect(response.status).toBe(201)
    return ((await response.json()) as { id: string }).id
  }

  async function as(who: string, method: string, path: string, body?: unknown) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        cookie: `__Host-tilchi_sid=${who}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    expect(res.status, `${method} ${path}`).toBeLessThan(300)
    return (await res.json()) as Json
  }

  async function freshAssessment(level: Assess) {
    const made = async (body: unknown, publish: boolean) => {
      const q = await as('owner', 'POST', '/api/questions', body)
      if (publish) {
        await as('owner', 'PATCH', `/api/questions/${q.id}`, {
          status: 'published',
        })
      }
      return q.id as string
    }
    const out = { question: '', test: '', attempt: '', speaking: '' }
    if (level === 'draft') {
      out.question = await made({ type: 'speaking', prompt: 'P' }, false)
      return out
    }
    out.question = await made(
      { type: 'single', prompt: 'P', options: ['a', 'b'], correct: [0] },
      true,
    )
    if (level === 'published') return out
    out.speaking = await made({ type: 'speaking', prompt: 'S' }, true)
    const test = await as('owner', 'POST', '/api/tests', {
      title: 'T',
      questionIds: [out.question, out.speaking],
    })
    out.test = test.id
    if (level === 'test') return out
    const assigned = await as(
      'owner',
      'POST',
      `/api/groups/${group}/assignments`,
      {
        testId: out.test,
        deadline: soon(),
      },
    )
    const mine = await as('member', 'GET', '/api/me/assignments')
    out.attempt =
      mine.assignments.find((a) => a.assignmentId === assigned.id)?.attemptId ??
      ''
    if (level === 'audio') {
      await as('member', 'POST', `/api/attempts/${out.attempt}/audio/presign`, {
        questionId: out.speaking,
        contentType: 'audio/webm',
        size: 10,
      })
    }
    if (level === 'submitted') {
      await as('member', 'POST', `/api/attempts/${out.attempt}/submit`, {
        answers: {},
      })
    }
    return out
  }

  for (const row of ROWS) {
    it(row.name, async () => {
      for (const [index, who] of WHO.entries()) {
        const ctx: Ctx = {
          group,
          lesson: row.lesson ? await freshLesson(row.lesson) : '',
          target: ids.target,
          teacher: ids.owner,
          notification: await freshNotification(),
          course: row.course ? await freshCourse() : '',
          ...(row.assess
            ? await freshAssessment(row.assess)
            : { question: '', test: '', attempt: '', speaking: '' }),
        }
        const headers: Record<string, string> = {
          'content-type': 'application/json',
        }
        if (who !== 'anonymous') headers.cookie = `__Host-tilchi_sid=${who}`
        const res = await fetch(base + row.path(ctx), {
          method: row.method,
          headers,
          body: row.body ? JSON.stringify(row.body(ctx)) : undefined,
        })
        expect(res.status, `${row.name} as ${who}`).toBe(row.expect[index])
      }
    })
  }

  it('tells the web what each caller may do', async () => {
    const lesson = await freshLesson('scheduled')
    const detail = async (who: string) => {
      const res = await fetch(`${base}/api/lessons/${lesson}`, {
        headers: { cookie: `__Host-tilchi_sid=${who}` },
      })
      return (await res.json()) as {
        lesson: { can: Record<string, boolean> }
        group: { can: Record<string, boolean> }
      }
    }
    expect((await detail('owner')).lesson.can).toMatchObject({
      start: true,
      cancel: true,
      join: false,
    })
    expect((await detail('admin')).group.can).toEqual({
      createLesson: true,
      manageMembers: true,
      seeMembers: true,
      assignTest: true,
      viewAssignments: true,
    })
    expect((await detail('owner')).group.can).toMatchObject({
      assignTest: true,
      viewAssignments: true,
    })
    expect((await detail('member')).group.can).toMatchObject({
      seeMembers: false,
      assignTest: false,
      viewAssignments: false,
    })
    expect((await detail('member')).lesson.can).toEqual({
      start: false,
      end: false,
      cancel: false,
      reschedule: false,
      join: false,
    })
    await groups.putMember(group, ids.other)
    expect((await detail('other')).lesson.can.start).toBe(false)
    const list = await fetch(`${base}/api/groups`, {
      headers: { cookie: '__Host-tilchi_sid=member' },
    })
    expect(((await list.json()) as { can: unknown }).can).toEqual({
      createGroup: false,
      assignTeacher: false,
      manageTests: false,
    })
    for (const who of ['owner', 'admin']) {
      const res = await fetch(`${base}/api/groups`, {
        headers: { cookie: `__Host-tilchi_sid=${who}` },
      })
      const flags = (await res.json()) as { can: Record<string, boolean> }
      expect(flags.can.manageTests, who).toBe(true)
    }
  })

  it('lets an admin name the teacher, who then manages that group', async () => {
    const create = (teacherId: string) =>
      fetch(`${base}/api/groups`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: '__Host-tilchi_sid=admin',
        },
        body: JSON.stringify({ name: 'Assigned', teacherId }),
      })
    expect((await create(ids.member)).status).toBe(400)
    expect((await create(ids.admin)).status).toBe(400)
    const made = await create(ids.other)
    expect(made.status).toBe(201)
    const { id } = (await made.json()) as { id: string }
    const lesson = await fetch(`${base}/api/groups/${id}/lessons`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: '__Host-tilchi_sid=other',
      },
      body: JSON.stringify({ scheduledAt: '2030-01-01T10:00:00Z' }),
    })
    expect(lesson.status).toBe(201)
    const creatorOnly = await fetch(`${base}/api/groups/${id}/lessons`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: '__Host-tilchi_sid=owner',
      },
      body: JSON.stringify({ scheduledAt: '2030-01-01T10:00:00Z' }),
    })
    expect(creatorOnly.status).toBe(404)
  })

  it('refuses an admin without an active teacher, and lists only id and name', async () => {
    const post = (body: unknown) =>
      fetch(`${base}/api/groups`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: '__Host-tilchi_sid=admin',
        },
        body: JSON.stringify(body),
      })
    for (const body of [{ name: 'X' }, { name: 'X', teacherId: 'nope' }]) {
      const res = await post(body)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'teacher_required' })
    }
    const list = await fetch(`${base}/api/teachers`, {
      headers: { cookie: '__Host-tilchi_sid=admin' },
    })
    const { teachers } = (await list.json()) as {
      teachers: Record<string, unknown>[]
    }
    expect(teachers.map((t) => Object.keys(t).sort())).toEqual(
      teachers.map(() => ['id', 'name']),
    )
    expect(teachers.map((t) => t.id)).toEqual(
      expect.arrayContaining([ids.owner, ids.other]),
    )
    expect(teachers.map((t) => t.id)).not.toContain(ids.member)
  })

  it('keeps the meet ticket session-only: no preview fallback', async () => {
    const demo = {
      nodeEnv: process.env.NODE_ENV,
      flag: process.env.TILCHI_DEMO,
    }
    process.env.NODE_ENV = 'test'
    process.env.TILCHI_DEMO = '1'
    try {
      const preview = { 'x-tilchi-preview-role': 'teacher' }
      const groups = await fetch(`${base}/api/groups`, { headers: preview })
      expect(groups.status).toBe(200)
      for (const cookie of [undefined, '__Host-tilchi_sid=bogus']) {
        const res = await fetch(`${base}/api/meet/ticket`, {
          method: 'POST',
          headers: cookie ? { ...preview, cookie } : preview,
        })
        expect(res.status).toBe(401)
      }
    } finally {
      process.env.NODE_ENV = demo.nodeEnv
      if (demo.flag === undefined) delete process.env.TILCHI_DEMO
      else process.env.TILCHI_DEMO = demo.flag
    }
  })

  it('refuses a bearer token on a protected route', async () => {
    const res = await fetch(`${base}/api/groups`, {
      headers: { authorization: 'Bearer x' },
    })
    expect(res.status).toBe(400)
  })

  it('keeps health and auth session public', async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200)
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
    const session = await fetch(`${base}/auth/session`)
    expect(await session.json()).toEqual({ user: null })
  })

  it('404s an unknown participant action for a signed-in caller', async () => {
    const res = await fetch(`${base}/api/meet/lessons/x/participants/y/ban`, {
      method: 'POST',
      headers: { cookie: '__Host-tilchi_sid=owner' },
    })
    expect(res.status).toBe(404)
  })
})
