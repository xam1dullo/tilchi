import { HttpException, Inject, Injectable } from '@nestjs/common'
import { uuidv7 } from '../id'
import { type Action, type Actor, authorize } from '../authz/policy'
import { GroupsService } from '../groups/groups.service'
import {
  LessonsRepository,
  type ChangeResult,
  type LessonMaterials,
} from './lessons.repository'

export type {
  Lesson,
  LessonMaterials,
  LessonStatus,
  Meeting,
} from './lessons.repository'

/**
 * A valid instant Postgres can store. Years outside 1..9999 parse in
 * JavaScript but would reach the database as an error, so they are refused here.
 */
export function parseScheduledAt(value: string) {
  const date = new Date(value)
  const year = date.getUTCFullYear()
  return Number.isNaN(date.getTime()) || year < 1 || year > 9999 ? null : date
}

const TOPIC_MAX = 120
const URL_MAX = 2048

/**
 * Reads the three material fields from a request body. A field that is
 * absent stays untouched; null or blank clears it. A topic is 1..120 chars
 * once trimmed; a link is an absolute http(s) URL of at most 2048 chars, so a
 * `javascript:` or relative link never reaches the page.
 */
export function parseMaterials(body: unknown): LessonMaterials {
  const input = (body ?? {}) as Record<string, unknown>
  const out: LessonMaterials = {}
  const read = (key: keyof LessonMaterials, ok: (v: string) => boolean) => {
    const raw = input[key]
    if (raw === undefined) return
    if (raw === null) {
      out[key] = null
      return
    }
    if (typeof raw !== 'string') {
      throw new HttpException({ error: 'invalid_material' }, 400)
    }
    const value = raw.replace(/\p{Cc}/gu, '').trim()
    if (value === '') {
      out[key] = null
      return
    }
    if (!ok(value)) throw new HttpException({ error: 'invalid_material' }, 400)
    out[key] = value
  }
  read('topic', (v) => v.length <= TOPIC_MAX)
  read('slideUrl', isHttpUrl)
  read('canvasUrl', isHttpUrl)
  return out
}

function isHttpUrl(value: string) {
  if (value.length > URL_MAX) return false
  try {
    const url = new URL(value)
    // Userinfo is refused: "https://docs.google.com@evil.example" reads as Google.
    if (url.username || url.password) return false
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

@Injectable()
export class LessonsService {
  constructor(
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository,
  ) {}

  async create(
    input: { groupId: string; scheduledAt: string; actor: Actor } & Partial<
      Record<keyof LessonMaterials, unknown>
    >,
  ) {
    const group = await this.groups.visible(input.actor, input.groupId)
    authorize(input.actor, 'lesson.create', group)
    return this.write({
      groupId: input.groupId,
      scheduledAt: input.scheduledAt,
      id: uuidv7(),
      ...parseMaterials(input),
    })
  }

  /** Sets topic and links on a scheduled or live lesson (ended/cancelled: 409). */
  async setMaterials(
    input: { lessonId: string; actor: Actor } & Partial<
      Record<keyof LessonMaterials, unknown>
    >,
  ) {
    await this.managed(input.actor, input.lessonId, 'lesson.editMaterials')
    const patch = parseMaterials(input)
    if (Object.keys(patch).length === 0) {
      throw new HttpException({ error: 'invalid_material' }, 400)
    }
    const result = await this.lessons.setMaterials(input.lessonId, patch)
    if (result.kind === 'not_found') {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (result.kind === 'conflict') {
      throw new HttpException({ error: 'lesson_not_editable' }, 409)
    }
    return result.lesson
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

  private async write(
    input: {
      id: string
      groupId: string
      scheduledAt: string
    } & LessonMaterials,
  ) {
    if (!(await this.groups.get(input.groupId))) {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    const scheduledAt = parseScheduledAt(input.scheduledAt)
    if (!scheduledAt) {
      throw new HttpException({ error: 'invalid_scheduled_at' }, 400)
    }
    const created = await this.lessons.insert({ ...input, scheduledAt })
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
