import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { Database } from '../db/database'
import { attendanceEvents, meetings, users } from '../db/schema'
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
