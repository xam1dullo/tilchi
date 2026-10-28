import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { Database } from '../db/database'
import {
  createTestDatabase,
  hasTestDatabase,
  type TestDatabase,
} from '../test/postgres'
import { PREVIEW_HEADER } from './policy'
import { DEMO_GROUP_ID, DEMO_LESSON_ID } from './policy'

describe.skipIf(!hasTestDatabase)('persisted classroom HTTP', () => {
  let database: TestDatabase
  let app: INestApplication
  let base = ''

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('TILCHI_DEMO', '1')
    vi.stubEnv('TILCHI_PREVIEW_ROLE', 'learner')
    vi.stubEnv('REDIS_URL', '')
    vi.stubEnv('LIVEKIT_API_KEY', 'devkey')
    vi.stubEnv('LIVEKIT_API_SECRET', 'devsecret')
    database = await createTestDatabase()
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Database)
      .useValue(Database.connect(database.url))
      .compile()
    app = mod.createNestApplication()
    await app.listen(0)
    base = await app.getUrl()
  })

  afterAll(async () => {
    await app?.close()
    await database?.drop()
    vi.unstubAllEnvs()
  })

  async function send(
    path: string,
    init: {
      method?: string
      preview?: string
      body?: unknown
    } = {},
  ) {
    const method = init.method ?? 'GET'
    const res = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(init.preview ? { [PREVIEW_HEADER]: init.preview } : {}),
      },
      body: method === 'GET' ? undefined : JSON.stringify(init.body ?? {}),
    })
    return { status: res.status, body: await res.json() }
  }

  describe('demo classroom HTTP', () => {
    it('seeds a group and lesson the preview teacher and learner can both see', async () => {
      const implied = await send('/api/groups')
      expect(implied.status).toBe(200)
      expect(implied.body.groups[0]?.id).toBe(DEMO_GROUP_ID)
      const preview = await send('/api/demo/preview')
      expect(preview.status).toBe(200)
      expect(preview.body.enabled).toBe(true)
      const teacher = await send('/api/groups', { preview: 'teacher' })
      expect(teacher.body.groups[0]?.id).toBe(DEMO_GROUP_ID)
      const learner = await send('/api/groups', { preview: 'learner' })
      expect(learner.body.groups[0]?.id).toBe(DEMO_GROUP_ID)
      const lessons = await send(`/api/groups/${DEMO_GROUP_ID}/lessons`, {
        preview: 'learner',
      })
      expect(lessons.body.lessons[0]?.id).toBe(DEMO_LESSON_ID)
      expect(lessons.body.lessons[0]?.status).toBe('scheduled')
    })

    it('lets the teacher start a lesson and mints a LiveKit token that is not a session', async () => {
      expect(
        (
          await send(`/api/meet/lessons/${DEMO_LESSON_ID}/token`, {
            method: 'POST',
            preview: 'learner',
          })
        ).status,
      ).toBe(409)
      const started = await send(`/api/lessons/${DEMO_LESSON_ID}/start`, {
        method: 'POST',
        preview: 'teacher',
      })
      expect(started.status).toBe(201)
      expect(started.body.lesson.status).toBe('live')
      const token = await send(`/api/meet/lessons/${DEMO_LESSON_ID}/token`, {
        method: 'POST',
        preview: 'learner',
      })
      expect(token.status).toBe(201)
      expect(token.body.token.split('.')).toHaveLength(3)
      expect(JSON.stringify(token.body)).not.toMatch(
        /tilchi_sid|session-secret/,
      )
      const ended = await send(`/api/lessons/${DEMO_LESSON_ID}/end`, {
        method: 'POST',
        preview: 'teacher',
      })
      expect(ended.body.status).toBe('ended')
    })

    it('keeps learners from creating groups or starting lessons', async () => {
      const created = await send('/api/groups', {
        method: 'POST',
        preview: 'learner',
        body: { name: 'Nope' },
      })
      expect(created.status).toBe(403)
      const scheduled = await send(`/api/groups/${DEMO_GROUP_ID}/lessons`, {
        method: 'POST',
        preview: 'learner',
        body: { scheduledAt: '2026-12-01T09:00:00+05:00' },
      })
      expect(scheduled.status).toBe(403)
    })
  })
})
