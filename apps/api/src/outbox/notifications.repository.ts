import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { Database } from '../db/database'
import { notifications } from '../db/schema'
import { isUuid } from '../db/uuid'
import { uuidv7 } from '../id'

export type Notification = {
  id: string
  userId: string
  event: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

function toNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: row.id,
    userId: row.userId,
    event: row.event,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

const LIST_LIMIT = 50

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** One inbox row per (outbox row, user): a redelivered row adds nothing. */
  async add(input: {
    outboxId: string | null
    userId: string
    event: string
    title: string
    body: string
    link: string | null
  }): Promise<boolean> {
    const rows = await this.database.db
      .insert(notifications)
      .values({ id: uuidv7(), ...input })
      .onConflictDoNothing()
      .returning({ id: notifications.id })
    return rows.length > 0
  }

  async get(id: string): Promise<Notification | null> {
    if (!isUuid(id)) return null
    const [row] = await this.database.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
    return row ? toNotification(row) : null
  }

  /** Newest first, only this user's. */
  async listFor(userId: string) {
    const rows = await this.database.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(LIST_LIMIT)
    const [{ unread }] = await this.database.db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      )
    return { notifications: rows.map(toNotification), unread }
  }

  /** The query itself is scoped to `userId`; reading twice keeps the first time. */
  async markRead(id: string, userId: string, now: Date): Promise<boolean> {
    const rows = await this.database.db
      .update(notifications)
      .set({
        readAt: sql`coalesce(${notifications.readAt}, ${now.toISOString()}::timestamptz)`,
      })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id })
    return rows.length > 0
  }
}
