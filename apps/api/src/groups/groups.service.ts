import { HttpException, Injectable } from '@nestjs/common'
import { uuidv7 } from '../id'
import type { Role } from '../auth/policy'

export type Group = {
  id: string
  name: string
  capacity: number
  createdBy: string
  memberIds: string[]
}

const MAX = 12

@Injectable()
export class GroupsService {
  private readonly groups = new Map<string, Group>()
  private readonly membership = new Map<string, Set<string>>()

  create(input: { name: string; actorId: string; role: Role }) {
    if (input.role !== 'teacher' && input.role !== 'admin') {
      throw new HttpException({ error: 'forbidden' }, 403)
    }
    const group: Group = {
      id: uuidv7(),
      name: input.name.trim().slice(0, 80) || 'Group',
      capacity: MAX,
      createdBy: input.actorId,
      memberIds: [],
    }
    this.groups.set(group.id, group)
    group.memberIds.push(input.actorId)
    const set = this.membership.get(input.actorId) ?? new Set<string>()
    set.add(group.id)
    this.membership.set(input.actorId, set)
    return group
  }

  addMember(input: { groupId: string; userId: string; role: Role }) {
    if (input.role !== 'admin')
      throw new HttpException({ error: 'forbidden' }, 403)
    return this.putMember(input.groupId, input.userId)
  }

  ensure(input: { id: string; name: string; actorId: string }) {
    const existing = this.groups.get(input.id)
    if (existing) return existing
    const group: Group = {
      id: input.id,
      name: input.name.trim().slice(0, 80) || 'Group',
      capacity: MAX,
      createdBy: input.actorId,
      memberIds: [],
    }
    this.groups.set(group.id, group)
    return this.putMember(group.id, input.actorId)
  }

  putMember(groupId: string, userId: string) {
    const group = this.groups.get(groupId)
    if (!group) throw new HttpException({ error: 'not_found' }, 404)
    if (
      !group.memberIds.includes(userId) &&
      group.memberIds.length >= group.capacity
    ) {
      throw new HttpException({ error: 'group_full' }, 409)
    }
    if (!group.memberIds.includes(userId)) group.memberIds.push(userId)
    const set = this.membership.get(userId) ?? new Set<string>()
    set.add(group.id)
    this.membership.set(userId, set)
    return group
  }

  listForUser(userId: string, role?: Role) {
    if (role === 'admin') return [...this.groups.values()]
    const ids = this.membership.get(userId) ?? new Set<string>()
    return [...ids].flatMap((id) => {
      const group = this.groups.get(id)
      return group ? [group] : []
    })
  }

  get(id: string) {
    return this.groups.get(id) ?? null
  }
}
