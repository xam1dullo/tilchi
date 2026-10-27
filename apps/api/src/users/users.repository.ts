import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Role } from '../auth/policy'
import { DB, type Db } from '../db/client'
import { users } from '../db/schema'
import { uuidv7 } from '../id'

export type UserRecord = {
  id: string
  telegramUserId: string | null
  role: Role
  name: string | null
}

const NAME_MAX = 100

const columns = {
  id: users.id,
  telegramUserId: users.telegramUserId,
  role: users.role,
  name: users.name,
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  // One row per verified Telegram account. The role mirrors the allow-list at
  // every login; a stored name wins over the Telegram profile name. Returns
  // null for a soft-deleted account, which is left untouched.
  async upsertTelegram(input: {
    telegramUserId: string
    role: Role
    name?: string | null
  }): Promise<UserRecord | null> {
    const name = input.name?.trim().slice(0, NAME_MAX) || null
    const [row] = await this.db
      .insert(users)
      .values({
        id: uuidv7(),
        telegramUserId: input.telegramUserId,
        role: input.role,
        name,
      })
      .onConflictDoUpdate({
        target: users.telegramUserId,
        set: {
          role: input.role,
          name: sql`coalesce(${users.name}, excluded.name)`,
        },
        setWhere: isNull(users.deletedAt),
      })
      .returning(columns)
    return row ?? null
  }

  async findActive(id: string): Promise<UserRecord | null> {
    const [row] = await this.db
      .select(columns)
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
    return row ?? null
  }
}
