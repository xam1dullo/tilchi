import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, sql } from 'drizzle-orm'
import { Database } from '../db/database'
import { lessons, meetings } from '../db/schema'
import { isUuid } from '../db/uuid'
import { uuidv7 } from '../id'
import { type LessonCommand, lessonTransition } from './lesson-transition'

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

export type EndResult =
  | { kind: 'ended'; lesson: Lesson }
  | { kind: 'not_found' }
  | { kind: 'conflict' }

export type ChangeResult =
  | { kind: 'changed'; lesson: Lesson; previousScheduledAt: string }
  | { kind: 'unchanged'; lesson: Lesson }
  | { kind: 'not_found' }
  | { kind: 'conflict' }

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
      const step = lessonTransition(lesson, { type: 'start' }, now)
      if (step.kind === 'refused') return { kind: 'closed' }
      await tx
        .insert(meetings)
        .values({
          id: uuidv7(),
          lessonId: id,
          livekitRoom: `lesson-${id}`,
          openedAt: now,
        })
        .onConflictDoNothing()
      const [live] =
        step.kind === 'next'
          ? await tx
              .update(lessons)
              .set(step.patch)
              .where(eq(lessons.id, id))
              .returning()
          : [lesson]
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

  /** Cancels a scheduled lesson. Cancelling a cancelled one changes nothing. */
  async cancel(id: string, now: Date): Promise<ChangeResult> {
    return this.change(id, { type: 'cancel' }, now)
  }

  /** Moves a lesson that is still scheduled; any other status is a conflict. */
  async reschedule(id: string, scheduledAt: Date): Promise<ChangeResult> {
    return this.change(id, { type: 'reschedule', scheduledAt }, new Date())
  }

  private async change(
    id: string,
    command: LessonCommand,
    now: Date,
  ): Promise<ChangeResult> {
    if (!isUuid(id)) return { kind: 'not_found' }
    return this.database.db.transaction(async (tx) => {
      const [lesson] = await tx
        .select()
        .from(lessons)
        .where(eq(lessons.id, id))
        .for('update')
      if (!lesson) return { kind: 'not_found' }
      const step = lessonTransition(lesson, command, now)
      if (step.kind === 'refused') return { kind: 'conflict' }
      if (step.kind === 'same') {
        return { kind: 'unchanged', lesson: toLesson(lesson, null) }
      }
      const [row] = await tx
        .update(lessons)
        .set(step.patch)
        .where(eq(lessons.id, id))
        .returning()
      return {
        kind: 'changed',
        lesson: toLesson(row, null),
        previousScheduledAt: lesson.scheduledAt.toISOString(),
      }
    })
  }

  /**
   * Ends a live lesson and closes its Meeting, keeping the first end time.
   * A lesson that is scheduled or cancelled is a conflict, never overwritten.
   */
  async end(id: string, now: Date): Promise<EndResult> {
    if (!isUuid(id)) return { kind: 'not_found' }
    return this.database.db.transaction(async (tx) => {
      const [lesson] = await tx
        .select()
        .from(lessons)
        .where(eq(lessons.id, id))
        .for('update')
      if (!lesson) return { kind: 'not_found' }
      const step = lessonTransition(lesson, { type: 'end' }, now)
      if (step.kind === 'refused') return { kind: 'conflict' }
      const [ended] =
        step.kind === 'next'
          ? await tx
              .update(lessons)
              .set(step.patch)
              .where(eq(lessons.id, id))
              .returning()
          : [lesson]
      const [meeting] = await tx
        .update(meetings)
        .set({
          closedAt: sql`coalesce(${meetings.closedAt}, ${now.toISOString()}::timestamptz)`,
        })
        .where(eq(meetings.lessonId, id))
        .returning({ id: meetings.id })
      return { kind: 'ended', lesson: toLesson(ended, meeting?.id ?? null) }
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
