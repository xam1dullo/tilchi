import { expect, it } from 'vitest'
import { GroupsRepository } from '../groups/groups.repository'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { LessonEvents, type LessonEvent } from './lesson-events'
import { LessonsRepository } from './lessons.repository'
import { LessonsService } from './lessons.service'

const AT = '2026-11-01T09:00:00+05:00'

describeWithDatabase('LessonsService cancel and reschedule', (current) => {
  const setup = async () => {
    const db = current().database
    const groups = new GroupsService(new GroupsRepository(db))
    const events = new LessonEvents()
    const seen: LessonEvent[] = []
    events.on((event) => seen.push(event))
    const lessons = new LessonsService(
      groups,
      new LessonsRepository(db),
      events,
    )
    const teacher = await new UsersRepository(db).ensure({
      id: uuidv7(),
      role: 'teacher',
      name: 'T',
    })
    const group = await groups.create({
      name: 'A1',
      actorId: teacher.id,
      role: 'teacher',
    })
    const lesson = await lessons.create({
      groupId: group.id,
      scheduledAt: AT,
      role: 'teacher',
    })
    return { lessons, group, lesson, seen }
  }

  it('reschedules only a scheduled lesson and emits one event with both times', async () => {
    const { lessons, lesson, group, seen } = await setup()
    const moved = await lessons.reschedule({
      lessonId: lesson.id,
      scheduledAt: '2026-11-02T10:00:00+05:00',
      role: 'teacher',
    })
    expect(moved.scheduledAt).toBe('2026-11-02T05:00:00.000Z')
    expect(seen).toEqual([
      {
        type: 'lesson.rescheduled',
        lessonId: lesson.id,
        groupId: group.id,
        scheduledAt: '2026-11-02T05:00:00.000Z',
        previousScheduledAt: '2026-11-01T04:00:00.000Z',
      },
    ])
    await expect(
      lessons.reschedule({
        lessonId: lesson.id,
        scheduledAt: 'nope',
        role: 'teacher',
      }),
    ).rejects.toMatchObject({ status: 400 })
    await lessons.start({ lessonId: lesson.id, role: 'teacher' })
    await expect(
      lessons.reschedule({
        lessonId: lesson.id,
        scheduledAt: AT,
        role: 'teacher',
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(seen).toHaveLength(1)
  })

  it('cancels a scheduled lesson once, refuses a live one, and refuses learners', async () => {
    const { lessons, lesson, group, seen } = await setup()
    await expect(
      lessons.cancel({ lessonId: lesson.id, role: 'learner' }),
    ).rejects.toMatchObject({ status: 403 })
    const cancelled = await lessons.cancel({
      lessonId: lesson.id,
      role: 'teacher',
    })
    expect(cancelled.status).toBe('cancelled')
    await lessons.cancel({ lessonId: lesson.id, role: 'admin' })
    expect(seen).toEqual([
      {
        type: 'lesson.cancelled',
        lessonId: lesson.id,
        groupId: group.id,
        scheduledAt: '2026-11-01T04:00:00.000Z',
      },
    ])
    await expect(
      lessons.reschedule({
        lessonId: lesson.id,
        scheduledAt: AT,
        role: 'teacher',
      }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      lessons.start({ lessonId: lesson.id, role: 'teacher' }),
    ).rejects.toMatchObject({ status: 409 })
    const other = await lessons.create({
      groupId: group.id,
      scheduledAt: AT,
      role: 'teacher',
    })
    await lessons.start({ lessonId: other.id, role: 'teacher' })
    await expect(
      lessons.cancel({ lessonId: other.id, role: 'teacher' }),
    ).rejects.toMatchObject({ status: 409 })
  })
})
