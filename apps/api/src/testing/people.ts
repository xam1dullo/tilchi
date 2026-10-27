import { eq } from 'drizzle-orm'
import type { Role } from '../auth/policy'
import type { Db } from '../db/client'
import { users } from '../db/schema'
import { uuidv7 } from '../id'

let counter = 0

// A user row for repository tests that never go through Telegram sign-in.
export async function insertUser(
  db: Db,
  role: Role,
  name: string | null = null,
) {
  const id = uuidv7()
  await db
    .insert(users)
    .values({ id, telegramUserId: `fixture-${counter++}`, role, name })
  return id
}

export async function softDeleteUser(db: Db, id: string) {
  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id))
}
