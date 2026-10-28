import { HttpException, Inject, Injectable } from '@nestjs/common'
import { uuidv7 } from '../id'
import type { Role } from '../auth/policy'
import {
  type GroupKind,
  type GroupRecord,
  GroupsRepository,
} from './groups.repository'

export type Group = {
  id: string
  name: string
  capacity: number
  kind: GroupKind
  createdBy: string
  memberIds: string[]
  learnerCount: number
}

export type LearnerGroup = Omit<Group, 'memberIds'>

/** Learners only: the teacher and admins do not count (PRD Q11). */
export const GROUP_CAPACITY = 12

/** The API still calls the teacher who owns a group its creator. */
function toGroup(record: GroupRecord): Group {
  return {
    id: record.id,
    name: record.name,
    capacity: GROUP_CAPACITY,
    kind: record.kind,
    createdBy: record.teacherId,
    memberIds: record.memberIds,
    learnerCount: record.learnerCount,
  }
}

function cleanName(name: string) {
  return name.trim().slice(0, 80) || 'Group'
}

@Injectable()
export class GroupsService {
  constructor(
    @Inject(GroupsRepository) private readonly groups: GroupsRepository,
  ) {}

  async create(input: { name: string; actorId: string; role: Role }) {
    if (input.role !== 'teacher' && input.role !== 'admin') {
      throw new HttpException({ error: 'forbidden' }, 403)
    }
    return this.ensure({
      id: uuidv7(),
      name: input.name,
      actorId: input.actorId,
    })
  }

  async addMember(input: { groupId: string; userId: string; role: Role }) {
    if (input.role !== 'admin')
      throw new HttpException({ error: 'forbidden' }, 403)
    return this.putMember(input.groupId, input.userId)
  }

  /** Creates the group with `actorId` as its first member, or returns it as it is. */
  async ensure(input: { id: string; name: string; actorId: string }) {
    const created = await this.groups.insert({
      id: input.id,
      name: cleanName(input.name),
      teacherId: input.actorId,
    })
    if (created) return toGroup(created)
    return this.existing(input.id)
  }

  async putMember(groupId: string, userId: string) {
    const added = await this.groups.addMember(groupId, userId, GROUP_CAPACITY)
    if (added === 'no_group') {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (added === 'no_user') {
      throw new HttpException({ error: 'user_not_found' }, 404)
    }
    if (added === 'consent_required') {
      throw new HttpException({ error: 'guardian_consent_required' }, 409)
    }
    if (added === 'full') {
      throw new HttpException({ error: 'group_full' }, 409)
    }
    return this.existing(groupId)
  }

  async listForUser(userId: string, role?: Role) {
    const records =
      role === 'admin'
        ? await this.groups.listAll()
        : await this.groups.listForUser(userId)
    return records.map(toGroup)
  }

  async get(id: string) {
    const record = await this.groups.get(id)
    return record ? toGroup(record) : null
  }

  private async existing(id: string) {
    const group = await this.get(id)
    if (!group) throw new HttpException({ error: 'not_found' }, 404)
    return group
  }
}
