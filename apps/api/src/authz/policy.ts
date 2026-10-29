import { HttpException } from '@nestjs/common'
import type { Role } from '../auth/policy'

export type Actor = {
  userId: string
  role: Role
  name: string | null
}

/** What a Group rule needs: its assigned teacher (groups.teacher_id) and members. */
export type GroupScope = { teacherId: string; memberIds: string[] }

export type Action =
  | 'course.manage'
  | 'group.create'
  | 'teacher.list'
  | 'group.view'
  | 'group.addMember'
  | 'group.seeMembers'
  | 'lesson.create'
  | 'lesson.start'
  | 'lesson.end'
  | 'lesson.cancel'
  | 'lesson.reschedule'
  | 'meeting.join'
  | 'meeting.moderate'

const isManager = (actor: Actor) =>
  actor.role === 'admin' || actor.role === 'teacher'

const sees = (actor: Actor, group: GroupScope) =>
  actor.role === 'admin' || group.memberIds.includes(actor.userId)

const manages = (actor: Actor, group: GroupScope) =>
  actor.role === 'admin' ||
  (actor.role === 'teacher' && group.teacherId === actor.userId)

/**
 * The PRD permission matrix (Users, Roles & Permissions), the only place that
 * decides who may do what. Group actions need the group; without it, false.
 */
export function can(actor: Actor, action: Action, group?: GroupScope): boolean {
  if (action === 'group.create') return isManager(actor)
  if (
    action === 'group.addMember' ||
    action === 'teacher.list' ||
    action === 'course.manage'
  ) {
    return actor.role === 'admin'
  }
  if (!group) return false
  if (action === 'group.view' || action === 'meeting.join') {
    return sees(actor, group)
  }
  return sees(actor, group) && manages(actor, group)
}

/**
 * 404 for a group the actor cannot see (its existence stays private), 403 for
 * one they see but may not act on.
 */
export function authorize(actor: Actor, action: Action, group?: GroupScope) {
  if (group && !can(actor, 'group.view', group)) {
    throw new HttpException({ error: 'not_found' }, 404)
  }
  if (!can(actor, action, group)) {
    throw new HttpException({ error: 'forbidden' }, 403)
  }
}

/**
 * A notification belongs to one user. Nobody else reads or marks it, admins
 * included, and its existence stays private: anyone else gets a 404.
 */
export function authorizeNotification(
  actor: Actor,
  notification: { userId: string },
) {
  if (notification.userId !== actor.userId) {
    throw new HttpException({ error: 'not_found' }, 404)
  }
}
