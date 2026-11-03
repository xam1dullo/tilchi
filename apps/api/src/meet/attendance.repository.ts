import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { Database } from '../db/database'
import { attendanceEvents, lessons, meetings, users } from '../db/schema'
import { isUuid } from '../db/uuid'
import { uuidv7 } from '../id'

export type AttendanceKind = 'token' | 'join' | 'leave'

@Injectable()
export class AttendanceRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /**
   * Stores one event. With a LiveKit event id, a redelivered webhook is a
   * no-op. Returns false when nothing was written.
   */
  async record(input: {
    lessonId: string
    userId: string
    kind: AttendanceKind
    at?: Date
    livekitEventId?: string
  }): Promise<boolean> {
    const rows = await this.database.db
      .insert(attendanceEvents)
      .values({
        id: uuidv7(),
        lessonId: input.lessonId,
        userId: input.userId,
        kind: input.kind,
        at: input.at ?? new Date(),
        livekitEventId: input.livekitEventId,
      })
      .onConflictDoNothing()
      .returning({ id: attendanceEvents.id })
    return rows.length > 0
  }

  /** Join/leave/token events of these lessons, oldest first. */
  async eventsFor(lessonIds: string[]) {
    if (lessonIds.length === 0) return []
    return this.database.db
      .select({
        lessonId: attendanceEvents.lessonId,
        userId: attendanceEvents.userId,
        kind: attendanceEvents.kind,
        at: attendanceEvents.at,
      })
      .from(attendanceEvents)
      .where(inArray(attendanceEvents.lessonId, lessonIds))
      .orderBy(asc(attendanceEvents.at), asc(attendanceEvents.id))
  }

  /** A lesson's window: it started (or was due) and ended, if it has. */
  async lessonWindow(lessonId: string) {
    if (!isUuid(lessonId)) return null
    const [row] = await this.windows(eq(lessons.id, lessonId))
    return row ?? null
  }

  /** The group's lessons that went live, in time order. */
  async heldLessons(groupId: string) {
    if (!isUuid(groupId)) return []
    return this.windows(
      and(
        eq(lessons.groupId, groupId),
        inArray(lessons.status, ['live', 'ended']),
      ),
    )
  }

  private windows(where: ReturnType<typeof and>) {
    return this.database.db
      .select({
        id: lessons.id,
        status: lessons.status,
        scheduledAt: lessons.scheduledAt,
        startedAt: lessons.startedAt,
        endedAt: lessons.endedAt,
      })
      .from(lessons)
      .where(where)
      .orderBy(asc(lessons.scheduledAt), asc(lessons.id))
  }

  async lessonIdForRoom(room: string): Promise<string | null> {
    const [row] = await this.database.db
      .select({ lessonId: meetings.lessonId })
      .from(meetings)
      .where(eq(meetings.livekitRoom, room))
    return row?.lessonId ?? null
  }

  async userExists(id: string): Promise<boolean> {
    if (!isUuid(id)) return false
    const [row] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
    return Boolean(row)
  }
}
