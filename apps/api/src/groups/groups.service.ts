import { Inject, Injectable } from '@nestjs/common'
import type { SessionUser } from '../auth/auth.service'
import { parseUuid } from '../http/params'
import { apiError, unwrap } from '../http/result'
import {
  type GroupMember,
  type GroupSummary,
  GroupsRepository,
} from './groups.repository'
import {
  canCreateGroup,
  canManageGroups,
  chooseTeacher,
  parseGroupInput,
  parseMemberInput,
  teachesGroup,
} from './policy'

const LIST_LIMIT = 200

export type GroupView = GroupSummary & { members?: GroupMember[] }

// A group that is missing, deleted or not the caller's answers the same 404,
// so ids cannot be probed. Admin-only actions answer 403 before looking at ids.
@Injectable()
export class GroupsService {
  constructor(
    @Inject(GroupsRepository) private readonly groups: GroupsRepository,
  ) {}

  async create(actor: SessionUser, body: unknown): Promise<GroupView> {
    if (!canCreateGroup(actor.role)) throw apiError(403, 'forbidden')
    const input = unwrap(parseGroupInput(body))
    const teacherId = unwrap(chooseTeacher(actor, input.teacherId))
    if (!(await this.groups.teacherCandidate(teacherId))) {
      throw apiError(400, 'bad_teacher')
    }
    const id = await this.groups.create({
      name: input.name,
      capacity: input.capacity,
      teacherId,
      createdBy: actor.userId,
    })
    return this.get(actor, id)
  }

  async list(actor: SessionUser) {
    return { groups: await this.groups.listVisible(actor, LIST_LIMIT) }
  }

  // Only the teacher and admins see who is in the group; a learner sees the
  // seat count, never the other learners.
  async get(actor: SessionUser, rawId: string): Promise<GroupView> {
    const id = unwrap(parseUuid(rawId))
    const group = await this.groups.findVisible(actor, id)
    if (!group) throw apiError(404, 'not_found')
    if (!teachesGroup(actor, group.teacher.id)) return group
    return { ...group, members: await this.groups.listMembers(id) }
  }

  async addMember(
    actor: SessionUser,
    rawId: string,
    body: unknown,
  ): Promise<GroupView> {
    if (!canManageGroups(actor.role)) throw apiError(403, 'forbidden')
    const groupId = unwrap(parseUuid(rawId))
    const userId = unwrap(parseMemberInput(body))
    const outcome = await this.groups.addLearner(groupId, userId, actor.userId)
    if (outcome === 'no_group') throw apiError(404, 'not_found')
    if (outcome === 'no_learner') throw apiError(400, 'bad_user')
    if (outcome === 'already_member') throw apiError(409, 'already_member')
    if (outcome === 'full') throw apiError(409, 'group_full')
    return this.get(actor, groupId)
  }

  async removeMember(
    actor: SessionUser,
    rawId: string,
    rawUserId: string,
  ): Promise<void> {
    if (!canManageGroups(actor.role)) throw apiError(403, 'forbidden')
    const groupId = unwrap(parseUuid(rawId))
    const userId = unwrap(parseUuid(rawUserId, 'bad_user'))
    const outcome = await this.groups.removeLearner(groupId, userId)
    if (outcome !== 'removed') throw apiError(404, 'not_found')
  }

  async remove(actor: SessionUser, rawId: string): Promise<void> {
    if (!canManageGroups(actor.role)) throw apiError(403, 'forbidden')
    const id = unwrap(parseUuid(rawId))
    if (!(await this.groups.softDelete(id))) throw apiError(404, 'not_found')
  }
}
