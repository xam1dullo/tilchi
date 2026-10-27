import { Inject, Injectable } from '@nestjs/common'
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm'
import { DB, type Db } from '../db/client'
import { groupMembers, groups, users } from '../db/schema'
import { uuidv7 } from '../id'
import type { Actor } from './policy'

export type GroupSummary = {
  id: string
  name: string
  capacity: number
  teacher: { id: string; name: string | null }
  memberCount: number
  createdAt: Date
}

export type GroupMember = { userId: string; name: string | null; addedAt: Date }

export type AddLearnerOutcome =
  | 'added'
  | 'already_member'
  | 'full'
  | 'no_group'
  | 'no_learner'

export type RemoveLearnerOutcome = 'removed' | 'no_group' | 'not_member'

// An admin sees every group, a teacher the groups they teach, and anyone the
// groups they are an active member of. Lessons reuse this to decide visibility.
export function visibleTo(db: Db, actor: Actor): SQL {
  if (actor.role === 'admin') return sql`true`
  const member = exists(
    db
      .select({ one: sql`1` })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groups.id),
          eq(groupMembers.userId, actor.userId),
          isNull(groupMembers.removedAt),
        ),
      ),
  )
  if (actor.role === 'teacher') {
    return or(eq(groups.teacherId, actor.userId), member) as SQL
  }
  return member
}

@Injectable()
export class GroupsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async teacherCandidate(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          inArray(users.role, ['teacher', 'admin']),
          isNull(users.deletedAt),
        ),
      )
    return Boolean(row)
  }

  async create(input: {
    name: string
    capacity: number
    teacherId: string
    createdBy: string
  }): Promise<string> {
    const id = uuidv7()
    await this.db.insert(groups).values({ id, ...input })
    return id
  }

  async listVisible(actor: Actor, limit: number): Promise<GroupSummary[]> {
    const rows = await this.summaries()
      .where(and(isNull(groups.deletedAt), visibleTo(this.db, actor)))
      .orderBy(desc(groups.createdAt), asc(groups.id))
      .limit(limit)
    return rows.map(toSummary)
  }

  async findVisible(actor: Actor, id: string): Promise<GroupSummary | null> {
    const [row] = await this.summaries().where(
      and(
        eq(groups.id, id),
        isNull(groups.deletedAt),
        visibleTo(this.db, actor),
      ),
    )
    return row ? toSummary(row) : null
  }

  async listMembers(groupId: string): Promise<GroupMember[]> {
    return this.db
      .select({
        userId: groupMembers.userId,
        name: users.name,
        addedAt: groupMembers.addedAt,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(
        and(eq(groupMembers.groupId, groupId), isNull(groupMembers.removedAt)),
      )
      .orderBy(asc(groupMembers.addedAt), asc(groupMembers.userId))
  }

  // The group row is locked while the seats are counted, so two admins adding
  // at the same moment cannot both take the last seat.
  async addLearner(
    groupId: string,
    userId: string,
    addedBy: string,
  ): Promise<AddLearnerOutcome> {
    return this.db.transaction(async (tx) => {
      const [group] = await tx
        .select({ capacity: groups.capacity })
        .from(groups)
        .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
        .for('update')
      if (!group) return 'no_group'

      const [learner] = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, userId),
            eq(users.role, 'learner'),
            isNull(users.deletedAt),
          ),
        )
      if (!learner) return 'no_learner'

      const [membership] = await tx
        .select({ removedAt: groupMembers.removedAt })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId),
          ),
        )
      if (membership && !membership.removedAt) return 'already_member'

      const [{ seats }] = await tx
        .select({ seats: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            isNull(groupMembers.removedAt),
          ),
        )
      if (seats >= group.capacity) return 'full'

      await tx
        .insert(groupMembers)
        .values({ groupId, userId, addedBy })
        .onConflictDoUpdate({
          target: [groupMembers.groupId, groupMembers.userId],
          set: { removedAt: null, addedBy, addedAt: sql`now()` },
        })
      return 'added'
    })
  }

  async removeLearner(
    groupId: string,
    userId: string,
  ): Promise<RemoveLearnerOutcome> {
    const [group] = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    if (!group) return 'no_group'
    const removed = await this.db
      .update(groupMembers)
      .set({ removedAt: sql`now()` })
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          isNull(groupMembers.removedAt),
        ),
      )
      .returning({ userId: groupMembers.userId })
    return removed.length ? 'removed' : 'not_member'
  }

  async softDelete(groupId: string): Promise<boolean> {
    const deleted = await this.db
      .update(groups)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
      .returning({ id: groups.id })
    return deleted.length > 0
  }

  private summaries() {
    return this.db
      .select({
        id: groups.id,
        name: groups.name,
        capacity: groups.capacity,
        createdAt: groups.createdAt,
        teacherId: users.id,
        teacherName: users.name,
        memberCount: sql<number>`(
          select count(*)::int from ${groupMembers}
          where ${groupMembers.groupId} = ${groups.id}
            and ${groupMembers.removedAt} is null
        )`,
      })
      .from(groups)
      .innerJoin(users, eq(users.id, groups.teacherId))
  }
}

function toSummary(row: {
  id: string
  name: string
  capacity: number
  createdAt: Date
  teacherId: string
  teacherName: string | null
  memberCount: number
}): GroupSummary {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    teacher: { id: row.teacherId, name: row.teacherName },
    memberCount: row.memberCount,
    createdAt: row.createdAt,
  }
}
