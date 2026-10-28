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

type Ctx = { group: string; lesson: string; target: string }

/** Expected status per caller, in the order of WHO. */
type Row = {
  name: string
  handler: string
  method: 'GET' | 'POST'
  /** Lesson state the route needs; a fresh lesson is made per request. */
  lesson?: 'scheduled' | 'live'
  path: (ctx: Ctx) => string
  body?: (ctx: Ctx) => unknown
  expect: [number, number, number, number, number, number]
}

const ROWS: Row[] = [
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
    body: () => ({ name: 'New' }),
    expect: [401, 403, 403, 201, 201, 201],
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
      'DemoController.preview',
      'HealthController.apiHealth',
      'HealthController.health',
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

  for (const row of ROWS) {
    it(row.name, async () => {
      for (const [index, who] of WHO.entries()) {
        const ctx: Ctx = {
          group,
          lesson: row.lesson ? await freshLesson(row.lesson) : '',
          target: ids.target,
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
    })
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
