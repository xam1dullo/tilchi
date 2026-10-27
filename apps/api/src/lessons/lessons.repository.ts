import { Inject, Injectable } from '@nestjs/common'
import { and, desc, asc, eq, isNull, sql } from 'drizzle-orm'
import { DB, type Db } from '../db/client'
import { groups, lessons, meetings } from '../db/schema'
import { visibleTo } from '../groups/groups.repository'
import type { Actor } from '../groups/policy'
import { uuidv7 } from '../id'
import { type LessonAction, type LessonStatus, TRANSITIONS } from './policy'

// Everything the services need about a lesson. `livekitRoom` and `teacherId`
// are for server-side decisions only; the controller never sends them out.
export type LessonRecord = {
  id: string
  groupId: string
  groupName: string
  teacherId: string
  scheduledAt: Date
  status: LessonStatus
  createdAt: Date
  openedAt: Date | null
  closedAt: Date | null
  livekitRoom: string
}

@Injectable()
export class LessonsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  // A lesson and its meeting exist together or not at all. The room name is
  // made here from the lesson id; no client ever picks one.
  async create(groupId: string, scheduledAt: Date): Promise<string> {
    const lessonId = uuidv7()
    await this.db.transaction(async (tx) => {
      await tx.insert(lessons).values({ id: lessonId, groupId, scheduledAt })
      await tx.insert(meetings).values({
        id: uuidv7(),
        lessonId,
        livekitRoom: `lesson-${lessonId}`,
      })
    })
    return lessonId
  }

  async findVisible(
    actor: Actor,
    lessonId: string,
  ): Promise<LessonRecord | null> {
    const [row] = await this.records().where(
      and(
        eq(lessons.id, lessonId),
        isNull(groups.deletedAt),
        visibleTo(this.db, actor),
      ),
    )
    return row ?? null
  }

  // The caller has already checked that the group is visible to them.
  async listForGroup(groupId: string, limit: number): Promise<LessonRecord[]> {
    return this.records()
      .where(and(eq(lessons.groupId, groupId), isNull(groups.deletedAt)))
      .orderBy(desc(lessons.scheduledAt), asc(lessons.id))
      .limit(limit)
  }

  // Compare-and-set: the update only matches a lesson still in the expected
  // state, so of two simultaneous starts exactly one wins.
  async transition(lessonId: string, action: LessonAction): Promise<boolean> {
    const { from, to } = TRANSITIONS[action]
    return this.db.transaction(async (tx) => {
      const moved = await tx
        .update(lessons)
        .set({ status: to })
        .where(and(eq(lessons.id, lessonId), eq(lessons.status, from)))
        .returning({ id: lessons.id })
      if (moved.length === 0) return false
      if (action === 'start') {
        await tx
          .update(meetings)
          .set({ openedAt: sql`now()` })
          .where(eq(meetings.lessonId, lessonId))
      }
      if (action === 'end') {
        await tx
          .update(meetings)
          .set({ closedAt: sql`now()` })
          .where(eq(meetings.lessonId, lessonId))
      }
      return true
    })
  }

  private records() {
    return this.db
      .select({
        id: lessons.id,
        groupId: lessons.groupId,
        groupName: groups.name,
        teacherId: groups.teacherId,
        scheduledAt: lessons.scheduledAt,
        status: lessons.status,
        createdAt: lessons.createdAt,
        openedAt: meetings.openedAt,
        closedAt: meetings.closedAt,
        livekitRoom: meetings.livekitRoom,
      })
      .from(lessons)
      .innerJoin(groups, eq(groups.id, lessons.groupId))
      .innerJoin(meetings, eq(meetings.lessonId, lessons.id))
  }
}
