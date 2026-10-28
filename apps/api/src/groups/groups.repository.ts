import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, getTableColumns, inArray, isNull } from 'drizzle-orm'
import { Database } from '../db/database'
import { groupMembers, groups, users } from '../db/schema'
import { isUuid } from '../db/uuid'

export type GroupRecord = {
  id: string
  name: string
  teacherId: string
  /** In the order they joined; the teacher is the first member. */
  memberIds: string[]
}

export type AddMemberResult =
  | 'added'
  | 'already'
  | 'full'
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
      return { ...input, memberIds: [input.teacherId] }
    })
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
   * up and the capacity holds. Adding someone already in is not an error.
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
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
        .for('update')
      if (!group) return 'no_group'
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      if (!user) return 'no_user'
      const members = await tx
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, groupId))
      if (members.some((member) => member.userId === userId)) return 'already'
      if (members.length >= capacity) return 'full'
      await tx.insert(groupMembers).values({ groupId, userId })
      return 'added'
    })
  }

  private async withMembers(
    rows: (typeof groups.$inferSelect)[],
  ): Promise<GroupRecord[]> {
    if (rows.length === 0) return []
    const members = await this.database.db
      .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        inArray(
          groupMembers.groupId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(groupMembers.addedAt), asc(groupMembers.userId))
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      teacherId: row.teacherId,
      memberIds: members
        .filter((member) => member.groupId === row.id)
        .map((member) => member.userId),
    }))
  }
}
