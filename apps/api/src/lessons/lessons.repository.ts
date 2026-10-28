import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, sql } from 'drizzle-orm'
import { Database } from '../db/database'
import { lessons, meetings } from '../db/schema'
import { isUuid } from '../db/uuid'
import { uuidv7 } from '../id'

export type LessonStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

export type Lesson = {
  id: string
  groupId: string
  scheduledAt: string
  status: LessonStatus
  meetingId: string | null
}

export type Meeting = {
  id: string
  lessonId: string
  livekitRoom: string
  openedAt: string | null
  closedAt: string | null
}

export type StartResult =
  | { kind: 'started'; lesson: Lesson; meeting: Meeting }
  | { kind: 'not_found' }
  | { kind: 'closed' }

function toLesson(
  row: typeof lessons.$inferSelect,
  meetingId: string | null,
): Lesson {
  return {
    id: row.id,
    groupId: row.groupId,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    meetingId,
  }
}

function toMeeting(row: typeof meetings.$inferSelect): Meeting {
  return {
    id: row.id,
    lessonId: row.lessonId,
    livekitRoom: row.livekitRoom,
    openedAt: row.openedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  }
}

@Injectable()
export class LessonsRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** Null when the id is taken, so creating the same lesson twice changes nothing. */
  async insert(input: {
    id: string
    groupId: string
    scheduledAt: Date
  }): Promise<Lesson | null> {
    const [row] = await this.database.db
      .insert(lessons)
      .values(input)
      .onConflictDoNothing()
      .returning()
    return row ? toLesson(row, null) : null
  }

  async get(id: string): Promise<Lesson | null> {
    if (!isUuid(id)) return null
    return (await this.select(eq(lessons.id, id)))[0] ?? null
  }

  /** In time order, which is also the order the web page shows them. */
  async listForGroup(groupId: string): Promise<Lesson[]> {
    if (!isUuid(groupId)) return []
    return this.select(eq(lessons.groupId, groupId))
  }

  async meetingForLesson(lessonId: string): Promise<Meeting | null> {
    if (!isUuid(lessonId)) return null
    const [row] = await this.database.db
      .select()
      .from(meetings)
      .where(eq(meetings.lessonId, lessonId))
    return row ? toMeeting(row) : null
  }

  /**
   * Opens the lesson's one Meeting and marks it live. The lesson row is
   * locked, so starting twice, even at once, ends with the same Meeting.
   */
  async start(id: string, now: Date): Promise<StartResult> {
    if (!isUuid(id)) return { kind: 'not_found' }
    return this.database.db.transaction(async (tx) => {
      const [lesson] = await tx
        .select()
        .from(lessons)
        .where(eq(lessons.id, id))
        .for('update')
      if (!lesson) return { kind: 'not_found' }
      if (lesson.status === 'ended' || lesson.status === 'cancelled') {
        return { kind: 'closed' }
      }
      await tx
        .insert(meetings)
        .values({
          id: uuidv7(),
          lessonId: id,
          livekitRoom: `lesson-${id}`,
          openedAt: now,
        })
        .onConflictDoNothing()
      const [live] = await tx
        .update(lessons)
        .set({ status: 'live', startedAt: lesson.startedAt ?? now })
        .where(eq(lessons.id, id))
        .returning()
      const [meeting] = await tx
        .select()
        .from(meetings)
        .where(eq(meetings.lessonId, id))
      return {
        kind: 'started',
        lesson: toLesson(live, meeting.id),
        meeting: toMeeting(meeting),
      }
    })
  }

  /** Ends the lesson and closes its Meeting, keeping the first end time. */
  async end(id: string, now: Date): Promise<Lesson | null> {
    if (!isUuid(id)) return null
    return this.database.db.transaction(async (tx) => {
      const [lesson] = await tx
        .select()
        .from(lessons)
        .where(eq(lessons.id, id))
        .for('update')
      if (!lesson) return null
      const [ended] = await tx
        .update(lessons)
        .set({ status: 'ended', endedAt: lesson.endedAt ?? now })
        .where(eq(lessons.id, id))
        .returning()
      const [meeting] = await tx
        .update(meetings)
        .set({
          closedAt: sql`coalesce(${meetings.closedAt}, ${now.toISOString()}::timestamptz)`,
        })
        .where(eq(meetings.lessonId, id))
        .returning({ id: meetings.id })
      return toLesson(ended, meeting?.id ?? null)
    })
  }

  private async select(where: ReturnType<typeof and>): Promise<Lesson[]> {
    const rows = await this.database.db
      .select({ lesson: lessons, meetingId: meetings.id })
      .from(lessons)
      .leftJoin(meetings, eq(meetings.lessonId, lessons.id))
      .where(where)
      .orderBy(asc(lessons.scheduledAt), asc(lessons.id))
    return rows.map((row) => toLesson(row.lesson, row.meetingId))
  }
}
