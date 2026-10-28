import type { Role } from '../auth/policy'
import type { Group } from './groups.service'

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
  return actor.role === 'teacher' && group.memberIds.includes(actor.userId)
}
