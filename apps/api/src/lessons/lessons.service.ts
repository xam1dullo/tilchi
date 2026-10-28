import { HttpException, Inject, Injectable } from '@nestjs/common'
import { uuidv7 } from '../id'
import type { Role } from '../auth/policy'
import { GroupsService } from '../groups/groups.service'
import { LessonEvents } from './lesson-events'
import { LessonsRepository, type ChangeResult } from './lessons.repository'

export type { Lesson, LessonStatus, Meeting } from './lessons.repository'

/**
 * A valid instant Postgres can store. Years outside 1..9999 parse in
 * JavaScript but would reach the database as an error, so they are refused here.
 */
export function parseScheduledAt(value: string) {
  const date = new Date(value)
  const year = date.getUTCFullYear()
  return Number.isNaN(date.getTime()) || year < 1 || year > 9999 ? null : date
}

function requireManager(role: Role) {
  if (role !== 'teacher' && role !== 'admin') {
    throw new HttpException({ error: 'forbidden' }, 403)
  }
}

@Injectable()
export class LessonsService {
  constructor(
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository,
    @Inject(LessonEvents)
    private readonly events: LessonEvents = new LessonEvents(),
  ) {}

  async create(input: { groupId: string; scheduledAt: string; role: Role }) {
    requireManager(input.role)
    return this.write({ ...input, id: uuidv7() })
  }

  /** Returns the lesson with this id, creating it only when there is none. */
  async ensure(input: { id: string; groupId: string; scheduledAt: string }) {
    return (await this.lessons.get(input.id)) ?? this.write(input)
  }

  private async write(input: {
    id: string
    groupId: string
    scheduledAt: string
  }) {
    if (!(await this.groups.get(input.groupId))) {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    const scheduledAt = parseScheduledAt(input.scheduledAt)
    if (!scheduledAt) {
      throw new HttpException({ error: 'invalid_scheduled_at' }, 400)
    }
    const created = await this.lessons.insert({
      id: input.id,
      groupId: input.groupId,
      scheduledAt,
    })
    return created ?? this.existing(input.id)
  }

  listForGroup(groupId: string) {
    return this.lessons.listForGroup(groupId)
  }

  get(id: string) {
    return this.lessons.get(id)
  }

  async start(input: { lessonId: string; role: Role }) {
    requireManager(input.role)
    const started = await this.lessons.start(input.lessonId, new Date())
    if (started.kind === 'not_found') {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (started.kind === 'closed') {
      throw new HttpException({ error: 'lesson_closed' }, 409)
    }
    return { lesson: started.lesson, meeting: started.meeting }
  }

  async end(input: { lessonId: string; role: Role }) {
    requireManager(input.role)
    const ended = await this.lessons.end(input.lessonId, new Date())
    if (!ended) throw new HttpException({ error: 'not_found' }, 404)
    return ended
  }

  async cancel(input: { lessonId: string; role: Role }) {
    requireManager(input.role)
    const result = this.settled(
      await this.lessons.cancel(input.lessonId, new Date()),
    )
    if (result.kind === 'changed') {
      this.events.emit({
        type: 'lesson.cancelled',
        lessonId: result.lesson.id,
        groupId: result.lesson.groupId,
        scheduledAt: result.lesson.scheduledAt,
      })
    }
    return result.lesson
  }

  async reschedule(input: {
    lessonId: string
    scheduledAt: string
    role: Role
  }) {
    requireManager(input.role)
    const scheduledAt = parseScheduledAt(input.scheduledAt)
    if (!scheduledAt) {
      throw new HttpException({ error: 'invalid_scheduled_at' }, 400)
    }
    const result = this.settled(
      await this.lessons.reschedule(input.lessonId, scheduledAt),
    )
    if (result.kind === 'changed') {
      this.events.emit({
        type: 'lesson.rescheduled',
        lessonId: result.lesson.id,
        groupId: result.lesson.groupId,
        scheduledAt: result.lesson.scheduledAt,
        previousScheduledAt: result.previousScheduledAt,
      })
    }
    return result.lesson
  }

  private settled(result: ChangeResult) {
    if (result.kind === 'not_found') {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (result.kind === 'conflict') {
      throw new HttpException({ error: 'lesson_not_scheduled' }, 409)
    }
    return result
  }

  meetingForLesson(lessonId: string) {
    return this.lessons.meetingForLesson(lessonId)
  }

  private async existing(id: string) {
    const lesson = await this.lessons.get(id)
    if (!lesson) throw new HttpException({ error: 'not_found' }, 404)
    return lesson
  }
}
