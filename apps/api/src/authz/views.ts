import type { Group, LearnerGroup } from '../groups/groups.service'
import type { Lesson } from '../lessons/lessons.repository'
import { type Actor, can } from './policy'

/** Server-computed permissions: the web shows only what the API will allow. */
export type GroupCan = {
  createLesson: boolean
  manageMembers: boolean
  seeMembers: boolean
  assignTest: boolean
  viewAssignments: boolean
}
export type LessonCan = {
  start: boolean
  end: boolean
  cancel: boolean
  reschedule: boolean
  join: boolean
}

/** Only the Group's teacher and admins see who else is in it. */
export function groupView(
  actor: Actor,
  group: Group,
): (Group | LearnerGroup) & { can: GroupCan } {
  const allowed = {
    createLesson: can(actor, 'lesson.create', group),
    manageMembers: can(actor, 'group.addMember'),
    seeMembers: can(actor, 'group.seeMembers', group),
    assignTest: can(actor, 'test.assign', group),
    viewAssignments: can(actor, 'assignment.view', group),
  }
  if (allowed.seeMembers) return { ...group, can: allowed }
  const { memberIds: _ids, ...rest } = group
  return { ...rest, can: allowed }
}

export function lessonView(
  actor: Actor,
  group: Group,
  lesson: Lesson,
): Lesson & { can: LessonCan } {
  const scheduled = lesson.status === 'scheduled'
  return {
    ...lesson,
    can: {
      start: scheduled && can(actor, 'lesson.start', group),
      end: lesson.status === 'live' && can(actor, 'lesson.end', group),
      cancel: scheduled && can(actor, 'lesson.cancel', group),
      reschedule: scheduled && can(actor, 'lesson.reschedule', group),
      join: lesson.status === 'live' && can(actor, 'meeting.join', group),
    },
  }
}
