import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Role } from '../auth/policy'
import { Database } from '../db/database'
import { users } from '../db/schema'
import { isUuid } from '../db/uuid'
import { uuidv7 } from '../id'

export type User = {
  id: string
  /** Null only for demo users, which never sign in through Telegram. */
  telegramUserId: string | null
  role: Role
  name: string | null
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
      })
      .returning()
    return toUser(row)
  }

  async get(id: string): Promise<User | null> {
    if (!isUuid(id)) return null
    const [row] = await this.database.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
    return row ? toUser(row) : null
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
