import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, ilike, isNull, lt, or, sql } from 'drizzle-orm'
import type { Role } from '../auth/policy'
import { type Field, type Registration, nextField } from '../bot/registration'
import { Database, type Tx, inTransaction } from '../db/database'
import { users } from '../db/schema'
import { isUuid } from '../db/uuid'
import { uuidv7 } from '../id'
import { enqueue } from '../outbox/outbox.repository'

export type User = {
  id: string
  /** Null only for demo users, which never sign in through Telegram. */
  telegramUserId: string | null
  role: Role
  name: string | null
}

export type LearnerHit = {
  id: string
  name: string | null
  level: string | null
  guardianConsent: boolean
}

/** A soft-deleted user stays deleted: no login path may bring them back. */
export class DeletedUserError extends Error {
  constructor() {
    super('user is deleted')
  }
}

function parseList(value: string | undefined) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

export function roleForTelegram(telegramUserId: string): Role {
  if (parseList(process.env.TELEGRAM_ADMIN_ALLOWLIST).has(telegramUserId))
    return 'admin'
  if (parseList(process.env.TELEGRAM_TEACHER_ALLOWLIST).has(telegramUserId))
    return 'teacher'
  return 'learner'
}

function toRegistration(row: typeof users.$inferSelect): Registration {
  return {
    userId: row.id,
    name: row.name,
    level: row.level,
    studyHistory: row.studyHistory,
    phone: row.phone,
    goal: row.goal,
    source: row.source,
    consentAt: row.consentAt,
    consentVersion: row.consentVersion,
  }
}

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    telegramUserId: row.telegramId,
    role: row.role,
    name: row.name,
  }
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /**
   * One row per Telegram id, however many logins race. A blank name never
   * erases a known one, and the role is re-read from the allowlists each time.
   */
  async upsertTelegram(
    telegramUserId: string,
    name?: string | null,
  ): Promise<User> {
    const role = roleForTelegram(telegramUserId)
    const known = name || null
    const [row] = await this.database.db
      .insert(users)
      .values({ id: uuidv7(), telegramId: telegramUserId, role, name: known })
      .onConflictDoUpdate({
        target: users.telegramId,
        set: { role, name: sql`coalesce(${known}, ${users.name})` },
        setWhere: isNull(users.deletedAt),
      })
      .returning()
    if (!row) throw new DeletedUserError()
    return toUser(row)
  }

  async softDelete(id: string, now = new Date()) {
    await this.database.db
      .update(users)
      .set({ deletedAt: now })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
  }

  async registration(telegramUserId: string): Promise<Registration | null> {
    const [row] = await this.database.db
      .select()
      .from(users)
      .where(and(eq(users.telegramId, telegramUserId), isNull(users.deletedAt)))
    return row ? toRegistration(row) : null
  }

  /**
   * Consent is the first write for a visitor: the row is created here, not at
   * `/start`. Re-consenting to the same notice keeps the original time, and
   * the source and level already stored are never overwritten.
   */
  async recordConsent(input: {
    telegramUserId: string
    version: string
    now: Date
    source: string | null
    level: string | null
  }): Promise<Registration> {
    const { telegramUserId, version, now } = input
    const [row] = await this.database.db
      .insert(users)
      .values({
        id: uuidv7(),
        telegramId: telegramUserId,
        role: roleForTelegram(telegramUserId),
        consentAt: now,
        consentVersion: version,
        source: input.source,
        level: input.level,
      })
      .onConflictDoUpdate({
        target: users.telegramId,
        set: {
          consentAt: sql`case when ${users.consentVersion} = ${version} then ${users.consentAt} else ${now.toISOString()}::timestamptz end`,
          consentVersion: version,
          source: sql`coalesce(${users.source}, ${input.source})`,
          level: sql`coalesce(${users.level}, ${input.level})`,
        },
        setWhere: isNull(users.deletedAt),
      })
      .returning()
    if (!row) throw new DeletedUserError()
    return toRegistration(row)
  }

  /**
   * Stores one registration answer only while the field is still empty and the
   * update is newer than the last applied one, so a redelivered update is a
   * no-op: it returns null and the caller does nothing. The answer that
   * completes the registration queues the admin alert in the same transaction.
   */
  async saveAnswer(
    telegramUserId: string,
    field: Field,
    value: string,
    updateId?: number,
    outer?: Tx,
  ): Promise<Registration | null> {
    const column = users[field]
    // The update id is stored in the same statement as the answer, so a
    // replayed or older update can never fill the next field.
    const fresh =
      updateId === undefined
        ? undefined
        : or(isNull(users.lastUpdateId), lt(users.lastUpdateId, updateId))
    return inTransaction(this.database.db, outer, async (tx) => {
      const [row] = await tx
        .update(users)
        .set({
          [field]: value,
          ...(updateId === undefined ? {} : { lastUpdateId: updateId }),
        })
        .where(and(eq(users.telegramId, telegramUserId), isNull(column), fresh))
        .returning()
      if (!row) return null
      const saved = toRegistration(row)
      if (!nextField(saved)) {
        // Never includes the phone number.
        await enqueue(tx, {
          event: 'registration.completed',
          payload: {
            userId: saved.userId,
            telegramUserId,
            name: saved.name,
            level: saved.level,
            source: saved.source,
          },
          idempotencyKey: `registration.completed:${saved.userId}`,
        })
      }
      return saved
    })
  }

  async get(id: string): Promise<User | null> {
    if (!isUuid(id)) return null
    const [row] = await this.database.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
    return row ? toUser(row) : null
  }

  /** Active teachers for the admin's group form: id and display name only. */
  async listTeachers(): Promise<{ id: string; name: string | null }[]> {
    return this.database.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.role, 'teacher'), isNull(users.deletedAt)))
      .orderBy(asc(users.name), asc(users.id))
  }

  /**
   * Active learners whose name contains `q`, for the admin's enrol search.
   * Under 2 characters finds nothing; LIKE wildcards in `q` match literally.
   * Never phone, Telegram id or who gave the guardian consent.
   */
  async searchLearners(q: string): Promise<LearnerHit[]> {
    const text = q.trim().slice(0, 100)
    if (text.length < 2) return []
    const pattern = `%${text.replace(/[\\%_]/g, '\\$&')}%`
    const rows = await this.database.db
      .select({
        id: users.id,
        name: users.name,
        level: users.level,
        consentBy: users.guardianConsentBy,
        consentAt: users.guardianConsentAt,
      })
      .from(users)
      .where(
        and(
          eq(users.role, 'learner'),
          isNull(users.deletedAt),
          ilike(users.name, pattern),
        ),
      )
      .orderBy(asc(users.name), asc(users.id))
      .limit(20)
    return rows.map(({ consentBy, consentAt, ...row }) => ({
      ...row,
      guardianConsent: Boolean(consentBy && consentAt),
    }))
  }

  /**
   * Records who gave a learner's guardian consent. The first record is the
   * evidence (PRD G7) and is never rewritten: a repeat is a no-op success.
   * False when no active learner has `id`.
   */
  async recordGuardianConsent(id: string, by: string, now = new Date()) {
    if (!isUuid(id)) return false
    const learner = and(
      eq(users.id, id),
      eq(users.role, 'learner'),
      isNull(users.deletedAt),
    )
    const updated = await this.database.db
      .update(users)
      .set({ guardianConsentBy: by, guardianConsentAt: now })
      .where(
        and(
          learner,
          or(isNull(users.guardianConsentBy), isNull(users.guardianConsentAt)),
        ),
      )
      .returning({ id: users.id })
    if (updated.length > 0) return true
    const [found] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(learner)
    return Boolean(found)
  }

  /** A user with a fixed id, created once and never rewritten (demo seed). */
  async ensure(input: { id: string; role: Role; name: string }): Promise<User> {
    await this.database.db.insert(users).values(input).onConflictDoNothing()
    const [row] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, input.id))
    return toUser(row)
  }
}
