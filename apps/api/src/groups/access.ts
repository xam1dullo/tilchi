import type { Role } from '../auth/policy'
import type { Group, LearnerGroup } from './groups.service'

export type Actor = {
  userId: string
  role: Role
  name: string | null
}

export function canSeeGroup(actor: Actor, group: Group) {
  return actor.role === 'admin' || group.memberIds.includes(actor.userId)
}

export function canManageGroup(actor: Actor, group: Group) {
  if (actor.role === 'admin') return true
  return actor.role === 'teacher' && group.createdBy === actor.userId
}

/** Only the Group's teacher and admins see who else is in it. */
export function groupView(actor: Actor, group: Group): Group | LearnerGroup {
  if (canManageGroup(actor, group)) return group
  const { memberIds: _ids, ...rest } = group
  return rest
}
