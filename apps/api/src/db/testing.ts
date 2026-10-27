import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema'

export const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle')

export type TestDb = ReturnType<typeof drizzle<typeof schema, PGlite>>

// In-process Postgres built from the committed migrations, so tests run the
// same SQL as the VPS and a schema change without a migration fails here.
export async function createTestDb(): Promise<TestDb> {
  const db = drizzle(new PGlite(), { schema })
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return db
}

export async function resetTestDb(db: TestDb) {
  await db.execute(
    sql`truncate table group_members, meetings, lessons, groups, sessions, users cascade`,
  )
}

// Drizzle wraps driver errors; the Postgres SQLSTATE sits on `cause`.
export function pgCode(error: unknown): string | undefined {
  const own = error as { code?: unknown; cause?: unknown }
  if (typeof own?.code === 'string') return own.code
  const cause = own?.cause as { code?: unknown } | undefined
  return typeof cause?.code === 'string' ? cause.code : undefined
}
