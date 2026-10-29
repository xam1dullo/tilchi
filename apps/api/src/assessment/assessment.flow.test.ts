import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../app.module'
import { AuthService } from '../auth/auth.service'
import { Database } from '../db/database'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import { RoomAdmin } from '../meet/room-admin'
import { NotificationsRepository } from '../outbox/notifications.repository'
import { OutboxWorker } from '../outbox/outbox.worker'
import { KV, createMemoryKv } from '../redis/kv'
import { ObjectStorage } from '../storage/object-storage'
import { createTestDatabase, hasTestDatabase } from '../test/postgres'
import type { TestDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { DeadlineSweeper } from './deadline-sweeper'

const HOUR = 3_600_000

/** Remembers which keys were "uploaded"; presigned URLs point at /fake/<key>. */
class FakeStorage {
  uploaded = new Set<string>()
  keys: string[] = []
  presignUpload(key: string, type: string, size: number) {
    this.keys.push(key)
    return {
      url: `http://fake/${key}`,
      method: 'PUT',
      headers: { 'Content-Type': type, 'Content-Length': String(size) },
      expiresIn: 180,
    }
  }
  presignDownload(key: string) {
    return `http://fake/get/${key}`
  }
  /** Runs before each copy, to model a request landing mid-submit. */
  onCopy: () => Promise<void> = async () => {}
  copies = new Map<string, string>()
  copyOrder: string[] = []
  async copy(from: string, to: string) {
    await this.onCopy()
    // Real S3 refuses a copy onto itself, and a published copy is final.
    if (from === to || this.copies.has(to)) throw new Error('bad copy')
    if (!this.uploaded.has(from)) return false
    this.copies.set(to, from)
    this.copyOrder.push(to)
    return true
  }
}

describe.skipIf(!hasTestDatabase)('tests, assignments and grading', () => {
  let db: TestDatabase
  let app: INestApplication
  let base: string
  let worker: OutboxWorker
  let sweeper: DeadlineSweeper
  let inbox: NotificationsRepository
  let groups: GroupsService
  let storage: FakeStorage
  let seedUsers: () => Promise<void>
  const who = {} as Record<string, string>
  let group = ''

  beforeAll(async () => {
    db = await createTestDatabase()
    const actors = new Map<string, unknown>()
    storage = new FakeStorage()
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
        read: async (token: string | undefined) =>
          actors.get(token ?? '') ?? null,
      })
      .overrideProvider(RoomAdmin)
      .useValue({
        close: async () => {},
        mute: async () => {},
        remove: async () => {},
      })
      .overrideProvider(ObjectStorage)
      .useValue(storage)
      .compile()
    app = ref.createNestApplication()
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()
    worker = ref.get(OutboxWorker)
    sweeper = ref.get(DeadlineSweeper)
    inbox = ref.get(NotificationsRepository)
    groups = ref.get(GroupsService)
    const users = ref.get(UsersRepository)
    seedUsers = async () => {
      for (const [name, role] of [
        ['teacher', 'teacher'],
        ['ana', 'learner'],
        ['bob', 'learner'],
        ['eve', 'learner'],
      ] as const) {
        const user = await users.ensure({ id: uuidv7(), role, name })
        who[name] = user.id
        actors.set(name, { userId: user.id, role, name })
      }
    }
  })

  beforeEach(async () => {
    // A drain kicked by the previous test may still hold locks on the outbox.
    await worker.onApplicationShutdown()
    await db.reset()
    await seedUsers()
    storage.uploaded.clear()
    storage.keys = []
    storage.copies.clear()
    storage.copyOrder = []
    storage.onCopy = async () => {}
    group = (
      await groups.create({
        name: 'G',
        actor: { userId: who.teacher, role: 'teacher', name: 'teacher' },
      })
    ).id
    await groups.putMember(group, who.ana)
    await groups.putMember(group, who.bob)
  })

  afterAll(async () => {
    await app?.close()
    await db?.drop()
  })

  async function call(
    as: string,
    method: string,
    path: string,
    body?: unknown,
  ) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        cookie: `__Host-tilchi_sid=${as}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null }
  }

  async function question(body: Record<string, unknown>, publish = true) {
    const made = await call('teacher', 'POST', '/api/questions', body)
    expect(made.status).toBe(201)
    if (publish) {
      const done = await call(
        'teacher',
        'PATCH',
        `/api/questions/${made.body.id}`,
        {
          status: 'published',
        },
      )
      expect(done.status).toBe(200)
    }
    return made.body.id as string
  }

  /** A test with one single, one multi and one speaking question, assigned to the group. */
  async function setup(deadline = new Date(Date.now() + 48 * HOUR)) {
    const single = await question({
      type: 'single',
      prompt: 'Capital of France?',
      options: ['Rome', 'Paris', 'Oslo'],
      correct: [1],
    })
    const multi = await question({
      type: 'multi',
      prompt: 'Pick the fruits',
      options: ['apple', 'car', 'pear'],
      correct: [0, 2],
    })
    const speaking = await question({
      type: 'speaking',
      prompt: 'Describe your day',
    })
    const test = await call('teacher', 'POST', '/api/tests', {
      title: 'Unit 1',
      questionIds: [single, multi, speaking],
    })
    expect(test.status).toBe(201)
    const assigned = await call(
      'teacher',
      'POST',
      `/api/groups/${group}/assignments`,
      {
        testId: test.body.id,
        deadline: deadline.toISOString(),
      },
    )
    expect(assigned.status).toBe(201)
    const mine = await call('ana', 'GET', '/api/me/assignments')
    const attemptId = mine.body.assignments[0].attemptId as string
    return {
      single,
      multi,
      speaking,
      assignmentId: assigned.body.id as string,
      attemptId,
    }
  }

  const inboxOf = async (name: string) =>
    (await inbox.listFor(who[name])).notifications.map((n) => n.event)

  it('keeps the bank draft until published, then frozen', async () => {
    const id = await question(
      { type: 'single', prompt: 'Q', options: ['a', 'b'], correct: [0] },
      false,
    )
    const edit = await call('teacher', 'PATCH', `/api/questions/${id}`, {
      prompt: 'Q2',
      options: ['x', 'y', 'z'],
      correct: [2],
    })
    expect(edit.status).toBe(200)
    expect(edit.body).toMatchObject({
      prompt: 'Q2',
      answerKey: ['c'],
      status: 'draft',
    })
    expect(
      (
        await call('teacher', 'PATCH', `/api/questions/${id}`, {
          status: 'published',
        })
      ).status,
    ).toBe(200)
    const frozen = await call('teacher', 'PATCH', `/api/questions/${id}`, {
      prompt: 'again',
    })
    expect(frozen.status).toBe(409)
    expect(frozen.body).toMatchObject({ error: 'not_draft' })
  })

  it('rejects malformed questions', async () => {
    for (const body of [
      { type: 'single', prompt: 'Q', options: ['a'], correct: [0] },
      { type: 'single', prompt: 'Q', options: ['a', 'b'], correct: [0, 1] },
      { type: 'multi', prompt: 'Q', options: ['a', 'b'], correct: [5] },
      { type: 'speaking', prompt: 'Q', options: ['a', 'b'] },
      { type: 'essay', prompt: 'Q' },
      { type: 'speaking', prompt: '  ' },
    ]) {
      expect(
        (await call('teacher', 'POST', '/api/questions', body)).status,
        JSON.stringify(body),
      ).toBe(400)
    }
  })

  it('composes a test from published questions only, and keeps used questions', async () => {
    const draft = await question({ type: 'speaking', prompt: 'D' }, false)
    const bad = await call('teacher', 'POST', '/api/tests', {
      title: 'T',
      questionIds: [draft],
    })
    expect(bad.status).toBe(400)
    const { single } = await setup()
    const gone = await call('teacher', 'DELETE', `/api/questions/${single}`)
    expect(gone.status).toBe(409)
    expect(gone.body).toMatchObject({ error: 'in_use' })
  })

  it('assigns to the group, makes one attempt per learner and notifies them', async () => {
    const { assignmentId } = await setup()
    const rows = await db.database.db.execute(
      sql`select user_id from attempts where assignment_id = ${assignmentId}`,
    )
    expect(rows.rows.map((r) => r.user_id).sort()).toEqual(
      [who.ana, who.bob].sort(),
    )
    const queued = await db.database.db.execute(
      sql`select idempotency_key from outbox where event like 'test.%' order by idempotency_key`,
    )
    expect(queued.rows.map((r) => r.idempotency_key)).toEqual([
      `test.assigned:${assignmentId}`,
      `test.reminder.24h:${assignmentId}`,
      `test.reminder.3h:${assignmentId}`,
    ])
    await worker.drainOnce(new Date())
    expect(await inboxOf('ana')).toEqual(['test.assigned'])
    expect(await inboxOf('bob')).toEqual(['test.assigned'])
    expect(await inboxOf('eve')).toEqual([])
    expect(await inboxOf('teacher')).toEqual([])
  })

  it('skips reminders that are already in the past', async () => {
    await setup(new Date(Date.now() + 2 * HOUR))
    const queued = await db.database.db.execute(
      sql`select idempotency_key from outbox where event = 'test.reminder'`,
    )
    expect(queued.rows).toEqual([])
  })

  it('walks assigned, submitted, graded and tells the right people', async () => {
    const t = await setup()
    await worker.drainOnce(new Date())
    const view = await call('ana', 'GET', `/api/attempts/${t.attemptId}`)
    expect(view.status).toBe(200)
    expect(view.body.status).toBe('assigned')
    expect(JSON.stringify(view.body)).not.toContain('answerKey')

    const presign = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/audio/presign`,
      {
        questionId: t.speaking,
        contentType: 'audio/webm',
        size: 5000,
      },
    )
    expect(presign.status).toBe(201)
    expect(presign.body).toMatchObject({ method: 'PUT', expiresIn: 180 })
    expect(storage.keys).toHaveLength(1)
    expect(storage.keys[0]).toMatch(
      new RegExp(`^audio/${t.attemptId}/${t.speaking}/[0-9a-f-]{36}\\.webm$`),
    )
    storage.uploaded.add(storage.keys[0])

    const submit = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/submit`,
      {
        answers: { [t.single]: ['b'], [t.multi]: ['c', 'a'] },
      },
    )
    expect(submit.status).toBe(201)
    expect(submit.body).toMatchObject({
      status: 'submitted',
      recorded: [t.speaking],
    })

    const again = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/submit`,
      { answers: {} },
    )
    expect(again.status).toBe(409)
    expect(again.body).toMatchObject({ error: 'already_submitted' })

    await worker.drainOnce(new Date())
    expect(await inboxOf('teacher')).toEqual(['test.submitted'])

    const review = await call('teacher', 'GET', `/api/attempts/${t.attemptId}`)
    expect(
      review.body.questions.map(
        (q: { autoCorrect: boolean | null }) => q.autoCorrect,
      ),
    ).toEqual([true, true, null])
    const play = await call(
      'teacher',
      'GET',
      `/api/attempts/${t.attemptId}/audio/${t.speaking}`,
    )
    expect(play.status).toBe(200)
    // The teacher hears the copy frozen at submit, not the upload key.
    const [frozen] = storage.copyOrder
    expect(frozen).toMatch(/^submitted\//)
    expect(storage.copies.get(frozen)).toBe(storage.keys[0])
    expect(play.body.url).toBe(`http://fake/get/${frozen}`)

    const needScore = await call(
      'teacher',
      'POST',
      `/api/attempts/${t.attemptId}/grade`,
      {},
    )
    expect(needScore.status).toBe(400)
    expect(needScore.body).toMatchObject({ error: 'speaking_score_required' })

    const graded = await call(
      'teacher',
      'POST',
      `/api/attempts/${t.attemptId}/grade`,
      {
        speaking: { [t.speaking]: 4 },
        overrides: { [t.multi]: false },
        feedback: 'Good fluency',
      },
    )
    expect(graded.status).toBe(201)
    expect(graded.body).toMatchObject({
      status: 'graded',
      score: 1 + 0 + 4,
      maxScore: 7,
      feedback: 'Good fluency',
    })

    const regrade = await call(
      'teacher',
      'POST',
      `/api/attempts/${t.attemptId}/grade`,
      { speaking: { [t.speaking]: 5 } },
    )
    expect(regrade.status).toBe(409)

    await worker.drainOnce(new Date())
    expect(await inboxOf('ana')).toEqual(
      expect.arrayContaining(['test.graded']),
    )
    expect(await inboxOf('bob')).not.toContain('test.graded')

    const mine = await call('ana', 'GET', `/api/attempts/${t.attemptId}`)
    expect(mine.body).toMatchObject({
      status: 'graded',
      score: 5,
      feedback: 'Good fluency',
    })
    expect(mine.body.questions[0].result).toEqual({ points: 1, max: 1 })
    expect(JSON.stringify(mine.body)).not.toContain('answerKey')
  })

  it('gives every upload url its own key, so an old url never replaces the take', async () => {
    const t = await setup()
    const presign = () =>
      call('ana', 'POST', `/api/attempts/${t.attemptId}/audio/presign`, {
        questionId: t.speaking,
        contentType: 'audio/webm',
        size: 10,
      })
    await presign()
    await presign()
    expect(new Set(storage.keys).size).toBe(2)
    // Only the newest key is the recording; the first url writes elsewhere.
    storage.uploaded.add(storage.keys[0])
    const submit = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/submit`,
      { answers: {} },
    )
    expect(submit.body.recorded).toEqual([])
  })

  it('a losing concurrent submit never writes over the winner’s frozen copy', async () => {
    const t = await setup()
    await call('ana', 'POST', `/api/attempts/${t.attemptId}/audio/presign`, {
      questionId: t.speaking,
      contentType: 'audio/webm',
      size: 10,
    })
    storage.uploaded.add(storage.keys[0])
    const submit = () =>
      call('ana', 'POST', `/api/attempts/${t.attemptId}/submit`, {
        answers: {},
      })
    const box: { second?: Awaited<ReturnType<typeof submit>> } = {}
    storage.onCopy = async () => {
      storage.onCopy = async () => {}
      // The second submit runs to the end while the first is mid-copy.
      box.second = await submit()
    }
    const first = await submit()
    expect(box.second?.status).toBe(201)
    expect(first.status).toBe(409)
    const [winner, loser] = storage.copyOrder
    expect(loser).toBeDefined()
    expect(loser).not.toBe(winner)
    const play = await call(
      'teacher',
      'GET',
      `/api/attempts/${t.attemptId}/audio/${t.speaking}`,
    )
    expect(play.body.url).toBe(`http://fake/get/${winner}`)
  })

  it('drops a recording whose url was issued after the copy, before the lock', async () => {
    const t = await setup()
    const presign = () =>
      call('ana', 'POST', `/api/attempts/${t.attemptId}/audio/presign`, {
        questionId: t.speaking,
        contentType: 'audio/webm',
        size: 10,
      })
    await presign()
    storage.uploaded.add(storage.keys[0])
    let raced = false
    storage.onCopy = async () => {
      if (raced) return
      raced = true
      // A new url lands while submit copies: the row now names a key that
      // was never copied, so submit must not keep it.
      expect((await presign()).status).toBe(201)
      storage.uploaded.add(storage.keys[1])
    }
    const submit = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/submit`,
      { answers: {} },
    )
    expect(submit.status).toBe(201)
    expect(submit.body.recorded).toEqual([])
    const play = await call(
      'teacher',
      'GET',
      `/api/attempts/${t.attemptId}/audio/${t.speaking}`,
    )
    expect(play.status).toBe(404)
  })

  it('drops an upload that never finished and grades 0 for it', async () => {
    const t = await setup()
    await call('ana', 'POST', `/api/attempts/${t.attemptId}/audio/presign`, {
      questionId: t.speaking,
      contentType: 'audio/mp4',
      size: 10,
    })
    expect(storage.keys[0]).toMatch(/\.mp4$/)
    const submit = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/submit`,
      { answers: {} },
    )
    expect(submit.body.recorded).toEqual([])
    const graded = await call(
      'teacher',
      'POST',
      `/api/attempts/${t.attemptId}/grade`,
      {},
    )
    expect(graded.status).toBe(201)
    expect(graded.body.score).toBe(0)
  })

  it('refuses bad audio requests', async () => {
    const t = await setup()
    const post = (body: unknown) =>
      call('ana', 'POST', `/api/attempts/${t.attemptId}/audio/presign`, body)
    expect(
      (
        await post({
          questionId: t.speaking,
          contentType: 'audio/ogg',
          size: 10,
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await post({
          questionId: t.speaking,
          contentType: 'audio/webm',
          size: 10 * 1024 * 1024 + 1,
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await post({
          questionId: t.speaking,
          contentType: 'audio/webm',
          size: 0,
        })
      ).status,
    ).toBe(400)
    const wrongQuestion = await post({
      questionId: t.single,
      contentType: 'audio/webm',
      size: 10,
    })
    expect(wrongQuestion.status).toBe(400)
    expect(wrongQuestion.body).toMatchObject({ error: 'not_speaking_question' })
    const unknown = await post({
      questionId: uuidv7(),
      contentType: 'audio/webm',
      size: 10,
    })
    expect(unknown.body).toMatchObject({ error: 'not_speaking_question' })
    expect(storage.keys).toEqual([])
  })

  it('refuses invalid answers', async () => {
    const t = await setup()
    for (const answers of [
      { [t.single]: ['a', 'b'] },
      { [t.single]: ['z'] },
      { [t.speaking]: ['a'] },
      { [uuidv7()]: ['a'] },
    ]) {
      const res = await call(
        'ana',
        'POST',
        `/api/attempts/${t.attemptId}/submit`,
        { answers },
      )
      expect(res.status, JSON.stringify(answers)).toBe(400)
    }
  })

  it('refuses a late submit with 409 and records the attempt as missed', async () => {
    const t = await setup()
    await db.database.db.execute(
      sql`update assignments set deadline = now() - interval '1 minute'`,
    )
    const late = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/submit`,
      { answers: {} },
    )
    expect(late.status).toBe(409)
    expect(late.body).toMatchObject({ error: 'deadline_passed' })
    const view = await call('ana', 'GET', `/api/attempts/${t.attemptId}`)
    expect(view.body.status).toBe('missed')
    const stored = await db.database.db.execute(
      sql`select status from attempts where id = ${t.attemptId}`,
    )
    expect(stored.rows[0].status).toBe('missed')
    const upload = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/audio/presign`,
      {
        questionId: t.speaking,
        contentType: 'audio/webm',
        size: 10,
      },
    )
    expect(upload.status).toBe(409)
    const grade = await call(
      'teacher',
      'POST',
      `/api/attempts/${t.attemptId}/grade`,
      {},
    )
    expect(grade.status).toBe(409)
    expect(grade.body).toMatchObject({ error: 'not_submitted' })
  })

  it('sweeps overdue open attempts to missed, once, and leaves submitted ones', async () => {
    const t = await setup()
    await call('ana', 'POST', `/api/attempts/${t.attemptId}/submit`, {
      answers: {},
    })
    await db.database.db.execute(
      sql`update assignments set deadline = now() - interval '1 minute'`,
    )
    expect(await sweeper.sweepOnce()).toBe(1)
    expect(await sweeper.sweepOnce()).toBe(0)
    const rows = await db.database.db.execute(
      sql`select u.name, a.status from attempts a join users u on u.id = a.user_id order by u.name`,
    )
    expect(rows.rows).toEqual([
      { name: 'ana', status: 'submitted' },
      { name: 'bob', status: 'missed' },
    ])
  })

  it('sends deadline reminders only to learners who have not submitted', async () => {
    const t = await setup()
    await call('ana', 'POST', `/api/attempts/${t.attemptId}/submit`, {
      answers: {},
    })
    await worker.drainOnce(new Date(Date.now() + 25 * HOUR))
    const events = async (name: string) =>
      (await inboxOf(name)).filter((e) => e === 'test.reminder')
    expect(await events('bob')).toHaveLength(1)
    expect(await events('ana')).toEqual([])
    expect(await events('teacher')).toEqual([])
    await worker.drainOnce(new Date(Date.now() + 25 * HOUR))
    expect(await events('bob')).toHaveLength(1)
    await worker.drainOnce(new Date(Date.now() + 46 * HOUR))
    expect(await events('bob')).toHaveLength(2)
    expect(await events('ana')).toEqual([])
  })

  it('lets exactly one of two simultaneous submits win', async () => {
    const t = await setup()
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        call('ana', 'POST', `/api/attempts/${t.attemptId}/submit`, {
          answers: {},
        }),
      ),
    )
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409])
    const queued = await db.database.db.execute(
      sql`select 1 from outbox where event = 'test.submitted'`,
    )
    expect(queued.rows).toHaveLength(1)
  })

  it('keeps attempts private to their learner and the Group teacher', async () => {
    const t = await setup()
    expect(
      (await call('bob', 'GET', `/api/attempts/${t.attemptId}`)).status,
    ).toBe(404)
    expect(
      (await call('eve', 'GET', `/api/attempts/${t.attemptId}`)).status,
    ).toBe(404)
    expect(
      (
        await call('bob', 'POST', `/api/attempts/${t.attemptId}/submit`, {
          answers: {},
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await call('teacher', 'POST', `/api/attempts/${t.attemptId}/submit`, {
          answers: {},
        })
      ).status,
    ).toBe(404)
    expect(
      (await call('ana', 'POST', `/api/attempts/${t.attemptId}/grade`, {}))
        .status,
    ).toBe(403)
    expect((await call('ana', 'GET', `/api/questions`)).status).toBe(403)
  })

  it('shows the group teacher who submitted and who is late', async () => {
    const t = await setup()
    await call('ana', 'POST', `/api/attempts/${t.attemptId}/submit`, {
      answers: {},
    })
    const list = await call(
      'teacher',
      'GET',
      `/api/groups/${group}/assignments`,
    )
    expect(list.status).toBe(200)
    expect(
      list.body.assignments[0].attempts.map(
        (a: { name: string; status: string }) => [a.name, a.status],
      ),
    ).toEqual([
      ['ana', 'submitted'],
      ['bob', 'assigned'],
    ])
  })

  it('refuses a deadline in the past or an unknown test', async () => {
    const t = await setup()
    const past = await call(
      'teacher',
      'POST',
      `/api/groups/${group}/assignments`,
      {
        testId: uuidv7(),
        deadline: new Date(Date.now() - 1000).toISOString(),
      },
    )
    expect(past.status).toBe(400)
    const unknown = await call(
      'teacher',
      'POST',
      `/api/groups/${group}/assignments`,
      {
        testId: uuidv7(),
        deadline: new Date(Date.now() + HOUR).toISOString(),
      },
    )
    expect(unknown.status).toBe(404)
    expect(t.assignmentId).toBeTruthy()
  })

  it('refuses audio after submit, and drops a reminder that would arrive after the deadline', async () => {
    const t = await setup()
    await call('ana', 'POST', `/api/attempts/${t.attemptId}/submit`, {
      answers: {},
    })
    const late = await call(
      'ana',
      'POST',
      `/api/attempts/${t.attemptId}/audio/presign`,
      {
        questionId: t.speaking,
        contentType: 'audio/webm',
        size: 10,
      },
    )
    expect(late.status).toBe(409)
    expect(late.body).toMatchObject({ error: 'already_submitted' })
    await worker.drainOnce(new Date(Date.now() + 49 * HOUR))
    expect((await inboxOf('bob')).filter((e) => e === 'test.reminder')).toEqual(
      [],
    )
  })

  it('refuses a deadline more than a year away', async () => {
    const t = await setup()
    const far = await call(
      'teacher',
      'POST',
      `/api/groups/${group}/assignments`,
      {
        testId: (await call('teacher', 'GET', '/api/tests')).body.tests[0].id,
        deadline: '+275760-09-13T00:00:00.000Z',
      },
    )
    expect(far.status).toBe(400)
    expect(t.assignmentId).toBeTruthy()
  })
})
