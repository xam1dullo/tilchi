import { Inject, Injectable } from '@nestjs/common'
import { type Actor, can } from '../authz/policy'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import { type AttendanceEvent, summarizeAttendance } from './attendance'
import { AttendanceRepository } from './attendance.repository'

/**
 * One learner in one lesson. A learner calling gets only their own row, so
 * the array never carries another learner's data (XAM-792).
 */
export type LessonAttendanceRow = {
  userId: string
  name: string | null
  present: boolean
  seconds: number
}

/**
 * One learner across the group's ended lessons; same own-row rule. `lessons`
 * (present count per ended lesson) is for the teacher and admin only: a
 * learner gets an empty list.
 */
export type GroupAttendance = {
  attendance: {
    userId: string
    name: string | null
    lessonsHeld: number
    lessonsPresent: number
  }[]
  lessons: { lessonId: string; present: number }[]
}

type Window = {
  status: string
  scheduledAt: Date
  startedAt: Date | null
  endedAt: Date | null
}

/** From the start (or the due time) to the end, or to `now` while live. */
const windowOf = (lesson: Window, now: Date) => ({
  start: lesson.startedAt ?? lesson.scheduledAt,
  end: lesson.endedAt ?? now,
})

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(LessonsService) private readonly lessons: LessonsService,
    @Inject(AttendanceRepository)
    private readonly attendance: AttendanceRepository,
  ) {}

  async forLesson(
    actor: Actor,
    lessonId: string,
    now = new Date(),
  ): Promise<{ attendance: LessonAttendanceRow[] }> {
    const { group } = await this.lessons.visible(actor, lessonId)
    const window = await this.attendance.lessonWindow(lessonId)
    if (!window) return { attendance: [] }
    const seen = new Map(
      summarizeAttendance(
        await this.attendance.eventsFor([lessonId]),
        windowOf(window, now),
      ).map((row) => [row.userId, row]),
    )
    const rows = (await this.learners(group.id)).map((learner) => ({
      userId: learner.id,
      name: learner.name,
      present: seen.get(learner.id)?.present ?? false,
      seconds: seen.get(learner.id)?.seconds ?? 0,
    }))
    return { attendance: this.ownRowUnless(actor, group, rows) }
  }

  async forGroup(actor: Actor, groupId: string): Promise<GroupAttendance> {
    const group = await this.groups.visible(actor, groupId)
    const held = await this.attendance.endedLessons(groupId)
    const learners = await this.learners(groupId)
    const learnerIds = new Set(learners.map((l) => l.id))
    const byLesson = new Map<string, AttendanceEvent[]>()
    for (const event of await this.attendance.eventsFor(
      held.map((l) => l.id),
    )) {
      byLesson.set(event.lessonId, [
        ...(byLesson.get(event.lessonId) ?? []),
        event,
      ])
    }
    // Only current learners count: the teacher and anyone since removed do not.
    const presentIn = held.map((lesson) => ({
      lessonId: lesson.id,
      users: new Set(
        summarizeAttendance(
          byLesson.get(lesson.id) ?? [],
          windowOf(lesson, new Date()),
        )
          .filter((row) => row.present && learnerIds.has(row.userId))
          .map((row) => row.userId),
      ),
    }))
    const rows = learners.map((learner) => ({
      userId: learner.id,
      name: learner.name,
      lessonsHeld: held.length,
      lessonsPresent: presentIn.filter((l) => l.users.has(learner.id)).length,
    }))
    const sees = can(actor, 'attendance.view', group)
    return {
      attendance: this.ownRowUnless(actor, group, rows),
      lessons: sees
        ? presentIn.map((l) => ({
            lessonId: l.lessonId,
            present: l.users.size,
          }))
        : [],
    }
  }

  private async learners(groupId: string) {
    return (await this.groups.membersOf(groupId)).filter(
      (member) => member.role === 'learner',
    )
  }

  private ownRowUnless<T extends { userId: string }>(
    actor: Actor,
    group: Parameters<typeof can>[2],
    rows: T[],
  ) {
    return can(actor, 'attendance.view', group)
      ? rows
      : rows.filter((row) => row.userId === actor.userId)
  }
}
