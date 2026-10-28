import { describe, expect, it } from 'vitest'
import { GroupsRepository } from '../groups/groups.repository'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { LessonsRepository } from './lessons.repository'
import { LessonsService, parseScheduledAt } from './lessons.service'
import { actorOf } from '../test/actors'

const AT = '2026-11-01T09:00:00+05:00'

describe('parseScheduledAt', () => {
  it('reads any ISO instant and keeps the moment, not the offset', () => {
    expect(parseScheduledAt(AT)?.toISOString()).toBe('2026-11-01T04:00:00.000Z')
    expect(parseScheduledAt('2026-11-01T04:00:00Z')?.toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    )
  })

  it('refuses what is not a date, or what Postgres cannot store', () => {
    for (const value of [
      '',
      'tomorrow',
      '0000-12-31T23:59:59Z',
      '+010000-01-01T00:00:00Z',
      '-000001-01-01T00:00:00Z',
    ]) {
      expect(parseScheduledAt(value)).toBeNull()
    }
    expect(parseScheduledAt('0001-01-01T00:00:00Z')).not.toBeNull()
    expect(parseScheduledAt('9999-12-31T23:59:59Z')).not.toBeNull()
  })
})

describeWithDatabase('LessonsService', (current) => {
  const build = () => {
    const db = current().database
    const groups = new GroupsService(new GroupsRepository(db))
    return {
      users: new UsersRepository(db),
      groups,
      lessons: new LessonsService(groups, new LessonsRepository(db)),
    }
  }
  const classroom = async () => {
    const parts = build()
    const teacher = await parts.users.ensure({
      id: uuidv7(),
      role: 'teacher',
      name: 'T',
    })
    const group = await parts.groups.create({
      name: 'A1',
      actor: actorOf('teacher', teacher.id),
    })
    return { ...parts, teacher, group }
  }
  const outcome = (promise: Promise<unknown>) =>
    promise.then(
      () => 'ok',
      (error: { status?: number; response?: { error?: string } }) =>
        `${error.status} ${error.response?.error}`,
    )

  it('moves scheduled to live with a meeting room, then ended', async () => {
    const { lessons, group } = await classroom()
    const lesson = await lessons.create({
      groupId: group.id,
      scheduledAt: AT,
      actor: actorOf('admin'),
    })
    expect(lesson).toEqual({
      id: expect.any(String),
      groupId: group.id,
      scheduledAt: '2026-11-01T04:00:00.000Z',
      status: 'scheduled',
      meetingId: null,
    })
    expect(await lessons.meetingForLesson(lesson.id)).toBeNull()
    const started = await lessons.start({
      lessonId: lesson.id,
      actor: actorOf('admin'),
    })
    expect(started.lesson.status).toBe('live')
    expect(started.lesson.meetingId).toBe(started.meeting.id)
    expect(started.meeting).toEqual({
      id: expect.any(String),
      lessonId: lesson.id,
      livekitRoom: `lesson-${lesson.id}`,
      openedAt: expect.stringMatching(/Z$/),
      closedAt: null,
    })
    const ended = await lessons.end({
      lessonId: lesson.id,
      actor: actorOf('admin'),
    })
    expect(ended.status).toBe('ended')
    expect(ended.meetingId).toBe(started.meeting.id)
    expect((await lessons.meetingForLesson(lesson.id))?.closedAt).toMatch(/Z$/)
    expect((await lessons.get(lesson.id))?.status).toBe('ended')
  })

  it('keeps the same meeting when a lesson is started twice, even at once', async () => {
    const { lessons, group } = await classroom()
    const lesson = await lessons.create({
      groupId: group.id,
      scheduledAt: AT,
      actor: actorOf('admin'),
    })
    const runs = await Promise.all(
      Array.from({ length: 4 }, () =>
        lessons.start({ lessonId: lesson.id, actor: actorOf('admin') }),
      ),
    )
    expect(new Set(runs.map((run) => run.meeting.id)).size).toBe(1)
    const again = await lessons.start({
      lessonId: lesson.id,
      actor: actorOf('admin'),
    })
    expect(again.meeting).toEqual(runs[0].meeting)
  })

  it('keeps the first end time when a lesson is ended twice', async () => {
    const { lessons, group } = await classroom()
    const lesson = await lessons.create({
      groupId: group.id,
      scheduledAt: AT,
      actor: actorOf('admin'),
    })
    await lessons.start({ lessonId: lesson.id, actor: actorOf('admin') })
    await lessons.end({ lessonId: lesson.id, actor: actorOf('admin') })
    const closed = (await lessons.meetingForLesson(lesson.id))?.closedAt
    await new Promise((resolve) => setTimeout(resolve, 5))
    await lessons.end({ lessonId: lesson.id, actor: actorOf('admin') })
    expect((await lessons.meetingForLesson(lesson.id))?.closedAt).toBe(closed)
  })

  it('refuses to end a lesson that never started, and to start one that ended', async () => {
    const { lessons, group } = await classroom()
    const lesson = await lessons.create({
      groupId: group.id,
      scheduledAt: AT,
      actor: actorOf('admin'),
    })
    expect(
      await outcome(
        lessons.end({ lessonId: lesson.id, actor: actorOf('admin') }),
      ),
    ).toBe('409 lesson_not_live')
    await lessons.start({ lessonId: lesson.id, actor: actorOf('admin') })
    await lessons.end({ lessonId: lesson.id, actor: actorOf('admin') })
    expect(
      await outcome(
        lessons.start({ lessonId: lesson.id, actor: actorOf('admin') }),
      ),
    ).toBe('409 lesson_closed')
  })

  it('keeps learners out of create, start and end', async () => {
    const { lessons, group, users, groups } = await classroom()
    const member = await users.ensure({
      id: uuidv7(),
      role: 'learner',
      name: 'L',
    })
    await groups.putMember(group.id, member.id)
    const actor = actorOf('learner', member.id)
    const lesson = await lessons.create({
      groupId: group.id,
      scheduledAt: AT,
      actor: actorOf('admin'),
    })
    expect(
      await outcome(
        lessons.create({ groupId: group.id, scheduledAt: AT, actor }),
      ),
    ).toBe('403 forbidden')
    expect(await outcome(lessons.start({ lessonId: lesson.id, actor }))).toBe(
      '403 forbidden',
    )
    expect(await outcome(lessons.end({ lessonId: lesson.id, actor }))).toBe(
      '403 forbidden',
    )
    expect((await lessons.get(lesson.id))?.status).toBe('scheduled')
  })

  it('refuses a missing group, a bad time, and lessons that do not exist', async () => {
    const { lessons, group } = await classroom()
    const create = (groupId: string, scheduledAt: string) =>
      outcome(lessons.create({ groupId, scheduledAt, actor: actorOf('admin') }))
    expect(await create(uuidv7(), AT)).toBe('404 not_found')
    expect(await create('not-a-uuid', AT)).toBe('404 not_found')
    expect(await create(group.id, '')).toBe('400 invalid_scheduled_at')
    expect(await create(group.id, '+010000-01-01T00:00:00Z')).toBe(
      '400 invalid_scheduled_at',
    )
    for (const lessonId of [uuidv7(), 'not-a-uuid']) {
      expect(
        await outcome(lessons.start({ lessonId, actor: actorOf('admin') })),
      ).toBe('404 not_found')
      expect(
        await outcome(lessons.end({ lessonId, actor: actorOf('admin') })),
      ).toBe('404 not_found')
      expect(await lessons.get(lessonId)).toBeNull()
      expect(await lessons.meetingForLesson(lessonId)).toBeNull()
    }
    expect(await lessons.listForGroup(group.id)).toEqual([])
  })

  it('keeps ensure on the same lesson id', async () => {
    const { lessons, group } = await classroom()
    const id = uuidv7()
    const first = await lessons.ensure({
      id,
      groupId: group.id,
      scheduledAt: AT,
    })
    const second = await lessons.ensure({
      id,
      groupId: group.id,
      scheduledAt: '2026-12-01T09:00:00+05:00',
    })
    expect(second).toEqual(first)
    expect(await lessons.listForGroup(group.id)).toHaveLength(1)
  })

  it('does not ensure a lesson in a group that does not exist', async () => {
    const { lessons } = await classroom()
    expect(
      await outcome(
        lessons.ensure({ id: uuidv7(), groupId: uuidv7(), scheduledAt: AT }),
      ),
    ).toBe('404 not_found')
  })

  it("lists a group's lessons by time, with their meeting, and no one else's", async () => {
    const { lessons, groups, teacher, group } = await classroom()
    const other = await groups.create({
      name: 'B1',
      actor: actorOf('teacher', teacher.id),
    })
    const later = await lessons.create({
      groupId: group.id,
      scheduledAt: '2026-11-03T09:00:00+05:00',
      actor: actorOf('admin'),
    })
    const sooner = await lessons.create({
      groupId: group.id,
      scheduledAt: '2026-11-02T09:00:00+05:00',
      actor: actorOf('admin'),
    })
    await lessons.create({
      groupId: other.id,
      scheduledAt: AT,
      actor: actorOf('admin'),
    })
    await lessons.start({ lessonId: sooner.id, actor: actorOf('admin') })
    const listed = await lessons.listForGroup(group.id)
    expect(listed.map((lesson) => lesson.id)).toEqual([sooner.id, later.id])
    expect(listed.map((lesson) => lesson.status)).toEqual(['live', 'scheduled'])
    expect(listed[0].meetingId).not.toBeNull()
    expect(listed[1].meetingId).toBeNull()
  })
})
