import { HttpException, Inject, Injectable } from '@nestjs/common'
import { uuidv7 } from '../id'
import { type Action, type Actor, authorize } from '../authz/policy'
import { GroupsService } from '../groups/groups.service'
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

@Injectable()
export class LessonsService {
  constructor(
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository,
  ) {}

  async create(input: { groupId: string; scheduledAt: string; actor: Actor }) {
    const group = await this.groups.visible(input.actor, input.groupId)
    authorize(input.actor, 'lesson.create', group)
    return this.write({
      groupId: input.groupId,
      scheduledAt: input.scheduledAt,
      id: uuidv7(),
    })
  }

  /** The lesson and its group, for an actor who may see the group; 404 otherwise. */
  async visible(actor: Actor, lessonId: string) {
    const lesson = await this.lessons.get(lessonId)
    if (!lesson) throw new HttpException({ error: 'not_found' }, 404)
    return { lesson, group: await this.groups.visible(actor, lesson.groupId) }
  }

  private async managed(actor: Actor, lessonId: string, action: Action) {
    const seen = await this.visible(actor, lessonId)
    authorize(actor, action, seen.group)
    return seen
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

  async start(input: { lessonId: string; actor: Actor }) {
    await this.managed(input.actor, input.lessonId, 'lesson.start')
    const started = await this.lessons.start(input.lessonId, new Date())
    if (started.kind === 'not_found') {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (started.kind === 'closed') {
      throw new HttpException({ error: 'lesson_closed' }, 409)
    }
    return { lesson: started.lesson, meeting: started.meeting }
  }

  async end(input: { lessonId: string; actor: Actor }) {
    await this.managed(input.actor, input.lessonId, 'lesson.end')
    const ended = await this.lessons.end(input.lessonId, new Date())
    if (ended.kind === 'not_found') {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (ended.kind === 'conflict') {
      throw new HttpException({ error: 'lesson_not_live' }, 409)
    }
    return ended.lesson
  }

  async cancel(input: { lessonId: string; actor: Actor }) {
    await this.managed(input.actor, input.lessonId, 'lesson.cancel')
    // The notice is queued by the repository, in the cancel transaction.
    return this.settled(await this.lessons.cancel(input.lessonId, new Date()))
      .lesson
  }

  async reschedule(input: {
    lessonId: string
    scheduledAt: string
    actor: Actor
  }) {
    await this.managed(input.actor, input.lessonId, 'lesson.reschedule')
    const scheduledAt = parseScheduledAt(input.scheduledAt)
    if (!scheduledAt) {
      throw new HttpException({ error: 'invalid_scheduled_at' }, 400)
    }
    return this.settled(
      await this.lessons.reschedule(input.lessonId, scheduledAt),
    ).lesson
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
