import { Inject, Injectable } from '@nestjs/common'
import type { SessionUser } from '../auth/auth.service'
import { GroupsRepository } from '../groups/groups.repository'
import { teachesGroup } from '../groups/policy'
import { parseUuid } from '../http/params'
import { apiError, unwrap } from '../http/result'
import { type LessonRecord, LessonsRepository } from './lessons.repository'
import {
  type LessonAction,
  type LessonStatus,
  TRANSITIONS,
  parseScheduledAt,
} from './policy'

const LIST_LIMIT = 100

// What a client may know about a lesson. The LiveKit room and the teacher's id
// stay on the server: a participant gets a token for the room, not its name.
export type LessonView = {
  id: string
  groupId: string
  groupName: string
  scheduledAt: Date
  status: LessonStatus
  createdAt: Date
  meeting: { openedAt: Date | null; closedAt: Date | null }
}

function toView(record: LessonRecord): LessonView {
  return {
    id: record.id,
    groupId: record.groupId,
    groupName: record.groupName,
    scheduledAt: record.scheduledAt,
    status: record.status,
    createdAt: record.createdAt,
    meeting: { openedAt: record.openedAt, closedAt: record.closedAt },
  }
}

// Order of answers: 400 for a malformed id, 404 for a group or lesson the
// caller cannot see, 403 for one they can see but may not run, then the body.
@Injectable()
export class LessonsService {
  constructor(
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository,
    @Inject(GroupsRepository) private readonly groups: GroupsRepository,
  ) {}

  async create(
    actor: SessionUser,
    rawGroupId: string,
    body: unknown,
    now = new Date(),
  ): Promise<LessonView> {
    const groupId = unwrap(parseUuid(rawGroupId))
    const group = await this.groups.findVisible(actor, groupId)
    if (!group) throw apiError(404, 'not_found')
    if (!teachesGroup(actor, group.teacher.id)) throw apiError(403, 'forbidden')
    const scheduledAt = unwrap(parseScheduledAt(body, now))
    const id = await this.lessons.create(groupId, scheduledAt)
    return this.get(actor, id)
  }

  async listForGroup(actor: SessionUser, rawGroupId: string) {
    const groupId = unwrap(parseUuid(rawGroupId))
    if (!(await this.groups.findVisible(actor, groupId))) {
      throw apiError(404, 'not_found')
    }
    const records = await this.lessons.listForGroup(groupId, LIST_LIMIT)
    return { lessons: records.map(toView) }
  }

  async get(actor: SessionUser, rawId: string): Promise<LessonView> {
    const id = unwrap(parseUuid(rawId))
    const record = await this.lessons.findVisible(actor, id)
    if (!record) throw apiError(404, 'not_found')
    return toView(record)
  }

  async transition(
    actor: SessionUser,
    rawId: string,
    action: LessonAction,
  ): Promise<LessonView> {
    const id = unwrap(parseUuid(rawId))
    const record = await this.lessons.findVisible(actor, id)
    if (!record) throw apiError(404, 'not_found')
    if (!teachesGroup(actor, record.teacherId)) throw apiError(403, 'forbidden')
    if (!(await this.lessons.transition(id, action))) {
      throw apiError(409, TRANSITIONS[action].error)
    }
    return this.get(actor, id)
  }
}
