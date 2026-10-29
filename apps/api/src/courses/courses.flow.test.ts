import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../app.module'
import { AuthService } from '../auth/auth.service'
import { Database } from '../db/database'
import { RoomAdmin } from '../meet/room-admin'
import { KV, createMemoryKv } from '../redis/kv'
import { createTestDatabase, hasTestDatabase } from '../test/postgres'
import type { TestDatabase } from '../test/postgres'

const draft = {
  title: 'Beginner English',
  description: 'A course for beginners',
  segment: 'kattalar',
  level: 'boshlovchi',
}

describe.skipIf(!hasTestDatabase)('course catalog HTTP flow', () => {
  let db: TestDatabase
  let app: INestApplication
  let base: string

  beforeAll(async () => {
    db = await createTestDatabase()
    const actors: Record<string, unknown> = {
      admin: { userId: 'admin', role: 'admin', name: 'admin' },
      teacher: { userId: 'teacher', role: 'teacher', name: 'teacher' },
      learner: { userId: 'learner', role: 'learner', name: 'learner' },
    }
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Database)
      .useValue(
        Object.create(db.database, {
          onApplicationShutdown: { value: async () => {} },
        }),
      )
      .overrideProvider(KV)
      .useValue(createMemoryKv())
      .overrideProvider(AuthService)
      .useValue({
        read: async (token: string | undefined) => actors[token ?? ''] ?? null,
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
  })

  beforeEach(async () => {
    await db.reset()
  })

  afterAll(async () => {
    await app?.close()
    await db?.drop()
  })

  function request(
    path: string,
    options: { method?: string; who?: string; body?: unknown } = {},
  ) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    if (options.who) headers.cookie = `__Host-tilchi_sid=${options.who}`
    return fetch(base + path, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  }

  it('keeps drafts private, publishes changes and hides soft-deleted courses', async () => {
    const created = await request('/api/courses', {
      method: 'POST',
      who: 'admin',
      body: draft,
    })
    expect(created.status).toBe(201)
    const course = (await created.json()) as { id: string; published: boolean }
    expect(course).toMatchObject({ ...draft, published: false })
    expect(await (await request('/api/courses')).json()).toMatchObject({
      courses: [],
    })
    expect(
      await (await request('/api/courses/manage', { who: 'admin' })).json(),
    ).toMatchObject({
      courses: [expect.objectContaining({ id: course.id, published: false })],
    })

    const published = await request(`/api/courses/${course.id}`, {
      method: 'PATCH',
      who: 'admin',
      body: { published: true, title: 'English' },
    })
    expect(published.status).toBe(200)
    expect(await (await request('/api/courses')).json()).toMatchObject({
      courses: [expect.objectContaining({ id: course.id, title: 'English' })],
    })

    expect(
      (
        await request(`/api/courses/${course.id}`, {
          method: 'DELETE',
          who: 'admin',
        })
      ).status,
    ).toBe(200)
    expect(await (await request('/api/courses')).json()).toMatchObject({
      courses: [],
    })
    expect(
      await (await request('/api/courses/manage', { who: 'admin' })).json(),
    ).toMatchObject({ courses: [] })
    expect(
      (
        await request(`/api/courses/${course.id}`, {
          method: 'PATCH',
          who: 'admin',
          body: { published: true },
        })
      ).status,
    ).toBe(404)
  })

  it('requires an admin for listing drafts and every mutation', async () => {
    const created = await request('/api/courses', {
      method: 'POST',
      who: 'admin',
      body: draft,
    })
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    for (const [who, expected] of [
      [undefined, 401],
      ['teacher', 403],
      ['learner', 403],
    ] as const) {
      expect((await request('/api/courses/manage', { who })).status).toBe(
        expected,
      )
      expect(
        (await request('/api/courses', { who, method: 'POST', body: draft }))
          .status,
      ).toBe(expected)
      expect(
        (
          await request(`/api/courses/${id}`, {
            who,
            method: 'PATCH',
            body: { published: true },
          })
        ).status,
      ).toBe(expected)
      expect(
        (await request(`/api/courses/${id}`, { who, method: 'DELETE' })).status,
      ).toBe(expected)
    }
    expect(
      await (await request('/api/courses/manage', { who: 'admin' })).json(),
    ).toMatchObject({
      courses: [expect.objectContaining({ id, published: false })],
    })
  })

  it('rejects malformed input without publishing or reflecting its contents', async () => {
    for (const body of [
      {},
      { ...draft, title: '   ' },
      { ...draft, description: 'x'.repeat(2001) },
      { ...draft, segment: 'unknown' },
      { ...draft, level: 'unknown' },
      { ...draft, published: 'true' },
      { ...draft, unexpected: 'private-input-marker' },
    ]) {
      const res = await request('/api/courses', {
        who: 'admin',
        method: 'POST',
        body,
      })
      expect(res.status).toBe(400)
      expect(await res.text()).not.toContain('private-input-marker')
    }
    expect(
      (
        await request('/api/courses/not-a-uuid', {
          who: 'admin',
          method: 'PATCH',
          body: { published: true },
        })
      ).status,
    ).toBe(404)
    expect(await (await request('/api/courses')).json()).toMatchObject({
      courses: [],
    })
  })
})
