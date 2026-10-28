import { Inject, Injectable } from '@nestjs/common'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { Database, type Tx, inTransaction } from '../db/database'
import { sessions, users } from '../db/schema'
import { uuidv7 } from '../id'
import { enqueue } from '../outbox/outbox.repository'
import { DeletedUserError } from './users.repository'

export type LiveSession = {
  userId: string
  expiresAt: Date
  absoluteExpiresAt: Date
}

@Injectable()
export class SessionsRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /**
   * Locks the user row and re-checks deleted_at before inserting, so a login
   * that read the user before `softDelete` cannot open a session after it.
   */
  async insert(input: {
    userId: string
    tokenHash: string
    now: Date
    idleExpiresAt: Date
    absoluteExpiresAt: Date
  }) {
    await this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
        .for('update')
      if (!user) throw new DeletedUserError()
      await tx.insert(sessions).values({
        id: uuidv7(),
        userId: input.userId,
        tokenHash: input.tokenHash,
        createdAt: input.now,
        lastSeenAt: input.now,
        expiresAt: input.idleExpiresAt,
        absoluteExpiresAt: input.absoluteExpiresAt,
      })
    })
  }

  /**
   * Finds a session that is neither revoked nor expired and slides its idle
   * expiry forward, never past the absolute cap. One statement, so a request
   * cannot revive a session that was revoked while it was reading.
   */
  async touch(
    tokenHash: string,
    now: Date,
    ttlMs: number,
  ): Promise<LiveSession | null> {
    const idleUntil = new Date(now.getTime() + ttlMs).toISOString()
    const [row] = await this.database.db
      .update(sessions)
      .set({
        lastSeenAt: now,
        expiresAt: sql`least(${idleUntil}::timestamptz, ${sessions.absoluteExpiresAt})`,
      })
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          gt(sessions.absoluteExpiresAt, now),
        ),
      )
      .returning({
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        absoluteExpiresAt: sessions.absoluteExpiresAt,
      })
    return row ?? null
  }

  async revoke(tokenHash: string, now: Date) {
    await this.database.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
  }

  /**
   * Revokes every live session of a user; returns their hashes for cache
   * cleanup. With `notify`, the "all sessions revoked" notice is queued in the
   * same transaction.
   */
  async revokeAllForUser(
    userId: string,
    now: Date,
    options: { notify?: boolean; tx?: Tx } = {},
  ) {
    return inTransaction(this.database.db, options.tx, async (tx) => {
      const rows = await tx
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
        .returning({ tokenHash: sessions.tokenHash })
      if (options.notify && rows.length > 0) {
        await enqueue(tx, {
          event: 'sessions.revoked',
          payload: { userId, count: rows.length },
          idempotencyKey: `sessions.revoked:${userId}:${uuidv7()}`,
        })
      }
      return rows.map((row) => row.tokenHash)
    })
  }
}
