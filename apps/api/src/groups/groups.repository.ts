import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, getTableColumns, inArray, isNull } from 'drizzle-orm'
import { Database } from '../db/database'
import { groupMembers, groups, users } from '../db/schema'
import { isUuid } from '../db/uuid'

export type GroupKind = (typeof groups.$inferSelect)['kind']

export type GroupRecord = {
  id: string
  name: string
  kind: GroupKind
  teacherId: string
  /** In the order they joined; the teacher is the first member. */
  memberIds: string[]
  /** Learners only; the teacher and admins are not counted (Q11). */
  learnerCount: number
}

export type AddMemberResult =
  | 'added'
  | 'already'
  | 'full'
  | 'consent_required'
  | 'no_group'
  | 'no_user'

@Injectable()
export class GroupsRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /**
   * Creates the group and its teacher's membership together. Returns null when
   * the id is taken, so creating the same group twice changes nothing.
   */
  async insert(input: {
    id: string
    name: string
    teacherId: string
  }): Promise<GroupRecord | null> {
    return this.database.db.transaction(async (tx) => {
      const created = await tx
        .insert(groups)
        .values(input)
        .onConflictDoNothing()
        .returning({ id: groups.id })
      if (created.length === 0) return null
      await tx
        .insert(groupMembers)
        .values({ groupId: input.id, userId: input.teacherId })
      return {
        ...input,
        kind: 'adult',
        memberIds: [input.teacherId],
        learnerCount: 0,
      }
    })
  }

  async isTeacher(id: string) {
    if (!isUuid(id)) return false
    const [row] = await this.database.db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
    return row?.role === 'teacher'
  }

  async get(id: string): Promise<GroupRecord | null> {
    if (!isUuid(id)) return null
    const rows = await this.database.db
      .select()
      .from(groups)
      .where(and(eq(groups.id, id), isNull(groups.deletedAt)))
    return (await this.withMembers(rows))[0] ?? null
  }

  async listAll(): Promise<GroupRecord[]> {
    const rows = await this.database.db
      .select()
      .from(groups)
      .where(isNull(groups.deletedAt))
      .orderBy(asc(groups.createdAt), asc(groups.id))
    return this.withMembers(rows)
  }

  async listForUser(userId: string): Promise<GroupRecord[]> {
    if (!isUuid(userId)) return []
    const rows = await this.database.db
      .select(getTableColumns(groups))
      .from(groups)
      .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groupMembers.userId, userId), isNull(groups.deletedAt)))
      .orderBy(asc(groups.createdAt), asc(groups.id))
    return this.withMembers(rows)
  }

  /**
   * The group row is locked while the count is checked, so racing adds queue
   * up and the capacity holds. Only learners count towards it, and a learner
   * joins a kids group only with guardian consent on record. Adding someone already in is not an error.
   */
  async addMember(
    groupId: string,
    userId: string,
    capacity: number,
  ): Promise<AddMemberResult> {
    if (!isUuid(groupId)) return 'no_group'
    if (!isUuid(userId)) return 'no_user'
    return this.database.db.transaction(async (tx) => {
      const [group] = await tx
        .select({ id: groups.id, kind: groups.kind })
        .from(groups)
        .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
        .for('update')
      if (!group) return 'no_group'
      const [user] = await tx
        .select({
          id: users.id,
          role: users.role,
          consentBy: users.guardianConsentBy,
          consentAt: users.guardianConsentAt,
        })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      if (!user) return 'no_user'
      const members = await tx
        .select({ userId: groupMembers.userId, role: users.role })
        .from(groupMembers)
        .innerJoin(users, eq(users.id, groupMembers.userId))
        .where(eq(groupMembers.groupId, groupId))
      if (members.some((member) => member.userId === userId)) return 'already'
      if (user.role === 'learner') {
        if (group.kind === 'kids' && !(user.consentBy && user.consentAt)) {
          return 'consent_required'
        }
        const learners = members.filter((m) => m.role === 'learner').length
        if (learners >= capacity) return 'full'
      }
      await tx.insert(groupMembers).values({ groupId, userId })
      return 'added'
    })
  }

  private async withMembers(
    rows: (typeof groups.$inferSelect)[],
  ): Promise<GroupRecord[]> {
    if (rows.length === 0) return []
    const members = await this.database.db
      .select({
        groupId: groupMembers.groupId,
        userId: groupMembers.userId,
        role: users.role,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(
        inArray(
          groupMembers.groupId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(groupMembers.addedAt), asc(groupMembers.userId))
    const inGroup = (id: string) => members.filter((m) => m.groupId === id)
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      teacherId: row.teacherId,
      memberIds: inGroup(row.id).map((member) => member.userId),
      learnerCount: inGroup(row.id).filter((m) => m.role === 'learner').length,
    }))
  }
}
