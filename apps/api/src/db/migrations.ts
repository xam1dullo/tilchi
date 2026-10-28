import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

// dist/db/migrations.js -> <app>/drizzle, both in the repo and in the image.
export const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle')

/**
 * Applies every pending migration in one transaction. Throws, never returns
 * quietly, when the journal is missing or a migration fails.
 */
export async function runMigrations(url: string, folder = MIGRATIONS_FOLDER) {
  const journal = join(folder, 'meta', '_journal.json')
  if (!existsSync(journal)) {
    throw new Error(
      `migrate: no migration journal at ${journal}; run db:generate and commit apps/api/drizzle`,
    )
  }
  const pool = new Pool({ connectionString: url })
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder })
  } finally {
    await pool.end()
  }
}
