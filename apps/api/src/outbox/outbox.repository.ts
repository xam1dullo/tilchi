import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'
import { Database, type Executor } from '../db/database'
import {
  attendanceEvents,
  groupMembers,
  groups,
  outbox,
  outboxDeliveries,
  users,
} from '../db/schema'
import { isUuid } from '../db/uuid'
import { uuidv7 } from '../id'
import type { OutboxEntry } from './events'
import type { Member } from './recipients'
import { backoffMs, isExhausted } from './retry'

export type OutboxRow = typeof outbox.$inferSelect

/**
 * Stores one outbox row through `executor`, which should be the transaction of
 * the domain write. A repeated idempotency key stores nothing; returns whether
 * a row was written.
 */
export async function enqueue(
  executor: Executor,
  entry: OutboxEntry,
): Promise<boolean> {
  const rows = await executor
    .insert(outbox)
    .values({
      id: uuidv7(),
      event: entry.event,
      payload: entry.payload,
      idempotencyKey: entry.idempotencyKey,
      availableAt: entry.availableAt,
    })
    .onConflictDoNothing({ target: outbox.idempotencyKey })
    .returning({ id: outbox.id })
  return rows.length > 0
}

export async function enqueueAll(executor: Executor, entries: OutboxEntry[]) {
  for (const entry of entries) await enqueue(executor, entry)
}

/** Retires the pending reminders of a lesson that was cancelled or moved. */
export async function supersedeReminders(
  executor: Executor,
  lessonId: string,
  now: Date,
) {
  await executor
    .update(outbox)
    .set({ sentAt: now, lastError: 'superseded' })
    .where(
      and(
        eq(outbox.event, 'lesson.reminder'),
        sql`${outbox.payload}->>'lessonId' = ${lessonId}`,
        isNull(outbox.sentAt),
        isNull(outbox.failedAt),
      ),
    )
}

/** What handling a claimed row decided: finished, or try again at a later time. */
export type Outcome = { kind: 'sent' } | { kind: 'defer'; until: Date }

@Injectable()
export class OutboxRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /**
   * Claims the oldest due row with `FOR UPDATE SKIP LOCKED` (so concurrent
   * workers never take the same row), runs `handle` on it, and records the
   * outcome in the same transaction. A throw counts as a failed attempt: the
   * row is retried with exponential backoff until the attempts run out.
   * Returns false when nothing was due.
   */
  async runNext(
    now: Date,
    handle: (row: OutboxRow) => Promise<Outcome>,
  ): Promise<boolean> {
    return this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(outbox)
        .where(
          and(
            isNull(outbox.sentAt),
            isNull(outbox.failedAt),
            lte(outbox.availableAt, now),
          ),
        )
        .orderBy(asc(outbox.availableAt), asc(outbox.id))
        .limit(1)
        .for('update', { skipLocked: true })
      if (!row) return false
      try {
        const outcome = await handle(row)
        await tx
          .update(outbox)
          .set(
            outcome.kind === 'sent'
              ? { sentAt: now, lastError: null }
              : { availableAt: outcome.until },
          )
          .where(eq(outbox.id, row.id))
      } catch (error) {
        const attempts = row.attempts + 1
        await tx
          .update(outbox)
          .set({
            attempts,
            lastError: String((error as Error).message ?? error).slice(0, 500),
            ...(isExhausted(attempts)
              ? { failedAt: now }
              : { availableAt: new Date(now.getTime() + backoffMs(attempts)) }),
          })
          .where(eq(outbox.id, row.id))
      }
      return true
    })
  }

  /** The group's members with their Telegram ids; the teacher is one of them. */
  async groupScope(groupId: string) {
    if (!isUuid(groupId)) return { teacherId: null, members: [] as Member[] }
    const [group] = await this.database.db
      .select({ teacherId: groups.teacherId })
      .from(groups)
      .where(eq(groups.id, groupId))
    const rows = await this.database.db
      .select({
        userId: users.id,
        telegramId: users.telegramId,
        role: users.role,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(and(eq(groupMembers.groupId, groupId), isNull(users.deletedAt)))
    return { teacherId: group?.teacherId ?? null, members: rows as Member[] }
  }

  async user(userId: string): Promise<Member | null> {
    if (!isUuid(userId)) return null
    const [row] = await this.database.db
      .select({
        userId: users.id,
        telegramId: users.telegramId,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    return (row as Member | undefined) ?? null
  }

  async joinedIds(lessonId: string): Promise<string[]> {
    if (!isUuid(lessonId)) return []
    const rows = await this.database.db
      .selectDistinct({ userId: attendanceEvents.userId })
      .from(attendanceEvents)
      .where(
        and(
          eq(attendanceEvents.lessonId, lessonId),
          eq(attendanceEvents.kind, 'join'),
        ),
      )
    return rows.map((row) => row.userId)
  }

  /** Chats that already got this row's message; a retry must not resend to them. */
  async deliveredChats(outboxId: string): Promise<Set<string>> {
    const rows = await this.database.db
      .select({ chatId: outboxDeliveries.chatId })
      .from(outboxDeliveries)
      .where(eq(outboxDeliveries.outboxId, outboxId))
    return new Set(rows.map((row) => row.chatId))
  }

  /** Committed on its own right after the send, so a later failure keeps it. */
  async markDelivered(outboxId: string, chatId: string) {
    await this.database.db
      .insert(outboxDeliveries)
      .values({ outboxId, chatId })
      .onConflictDoNothing()
  }
}
