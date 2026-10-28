import { Inject, Injectable } from '@nestjs/common'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { Database } from '../db/database'
import { sessions } from '../db/schema'
import { uuidv7 } from '../id'

export type LiveSession = {
  userId: string
  expiresAt: Date
  absoluteExpiresAt: Date
}

@Injectable()
export class SessionsRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async insert(input: {
    userId: string
    tokenHash: string
    now: Date
    idleExpiresAt: Date
    absoluteExpiresAt: Date
  }) {
    await this.database.db.insert(sessions).values({
      id: uuidv7(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      lastSeenAt: input.now,
      expiresAt: input.idleExpiresAt,
      absoluteExpiresAt: input.absoluteExpiresAt,
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
}
