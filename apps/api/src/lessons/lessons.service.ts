import { HttpException, Injectable } from '@nestjs/common'
import { uuidv7 } from '../id'
import type { Role } from '../auth/policy'
import { GroupsService } from '../groups/groups.service'

export type LessonStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

export type Lesson = {
  id: string
  groupId: string
  scheduledAt: string
  status: LessonStatus
  meetingId: string | null
}

export type Meeting = {
  id: string
  lessonId: string
  livekitRoom: string
  openedAt: string | null
  closedAt: string | null
}

@Injectable()
export class LessonsService {
  private readonly lessons = new Map<string, Lesson>()
  private readonly meetings = new Map<string, Meeting>()

  constructor(private readonly groups: GroupsService) {}

  create(input: { groupId: string; scheduledAt: string; role: Role }) {
    if (input.role !== 'teacher' && input.role !== 'admin') {
      throw new HttpException({ error: 'forbidden' }, 403)
    }
    if (!this.groups.get(input.groupId))
      throw new HttpException({ error: 'not_found' }, 404)
    const scheduled = new Date(input.scheduledAt)
    if (Number.isNaN(scheduled.getTime())) {
      throw new HttpException({ error: 'invalid_scheduled_at' }, 400)
    }
    const lesson: Lesson = {
      id: uuidv7(),
      groupId: input.groupId,
      scheduledAt: scheduled.toISOString(),
      status: 'scheduled',
      meetingId: null,
    }
    this.lessons.set(lesson.id, lesson)
    return lesson
  }

  listForGroup(groupId: string) {
    return [...this.lessons.values()].filter(
      (lesson) => lesson.groupId === groupId,
    )
  }

  get(id: string) {
    return this.lessons.get(id) ?? null
  }

  start(input: { lessonId: string; role: Role }) {
    if (input.role !== 'teacher' && input.role !== 'admin') {
      throw new HttpException({ error: 'forbidden' }, 403)
    }
    const lesson = this.lessons.get(input.lessonId)
    if (!lesson) throw new HttpException({ error: 'not_found' }, 404)
    if (lesson.status === 'ended' || lesson.status === 'cancelled') {
      throw new HttpException({ error: 'lesson_closed' }, 409)
    }
    if (!lesson.meetingId) {
      const meeting: Meeting = {
        id: uuidv7(),
        lessonId: lesson.id,
        livekitRoom: `lesson-${lesson.id}`,
        openedAt: new Date().toISOString(),
        closedAt: null,
      }
      this.meetings.set(meeting.id, meeting)
      lesson.meetingId = meeting.id
    }
    lesson.status = 'live'
    const meeting = lesson.meetingId
      ? this.meetings.get(lesson.meetingId)
      : undefined
    if (!meeting) throw new HttpException({ error: 'meeting_missing' }, 500)
    return { lesson, meeting }
  }

  end(input: { lessonId: string; role: Role }) {
    if (input.role !== 'teacher' && input.role !== 'admin') {
      throw new HttpException({ error: 'forbidden' }, 403)
    }
    const lesson = this.lessons.get(input.lessonId)
    if (!lesson) throw new HttpException({ error: 'not_found' }, 404)
    lesson.status = 'ended'
    if (lesson.meetingId) {
      const meeting = this.meetings.get(lesson.meetingId)
      if (meeting) meeting.closedAt = new Date().toISOString()
    }
    return lesson
  }

  meetingForLesson(lessonId: string) {
    const lesson = this.lessons.get(lessonId)
    if (!lesson?.meetingId) return null
    return this.meetings.get(lesson.meetingId) ?? null
  }
}
