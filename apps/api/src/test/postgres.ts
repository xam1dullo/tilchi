import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe } from 'vitest'
import { Database } from '../db/database'
import { runMigrations } from '../db/migrations'

/**
 * Postgres tests run when TEST_DATABASE_URL points at a Postgres 13+ server
 * whose user may CREATE DATABASE:
 *   TEST_DATABASE_URL=postgres://postgres:test@127.0.0.1:55431/tilchi_test \
 *     pnpm --filter @tilchi/api test
 * Each test file gets its own throwaway database with the real migrations
 * applied, so files run in parallel without touching each other. Without the
 * variable they are skipped, like the Redis checks. On GitHub Actions the
 * variable is mandatory, so a missing service cannot turn into silent skips.
 */
const configured = process.env.TEST_DATABASE_URL?.trim() || undefined

if (!configured && process.env.GITHUB_ACTIONS === 'true') {
  throw new Error(
    'TEST_DATABASE_URL is required in CI: the Postgres tests must run, not skip',
  )
}

export const hasTestDatabase = Boolean(configured)

export type TestDatabase = {
  url: string
  /** The same pool the API uses, connected to this database. */
  database: Database
  /** Empty every table and keep the schema. */
  reset(): Promise<void>
  /** Close the connections and drop the database. */
  drop(): Promise<void>
}

export async function createTestDatabase(
  options: { migrate?: boolean } = {},
): Promise<TestDatabase> {
  const base = new URL(configured as string)
  const name = `tilchi_t_${randomBytes(6).toString('hex')}`
  const admin = new Pool({ connectionString: base.toString(), max: 1 })
  await admin.query(`CREATE DATABASE ${name}`)
  base.pathname = `/${name}`
  const url = base.toString()
  const pool = new Pool({ connectionString: url, max: 1 })
  if (options.migrate !== false) await runMigrations(url)
  const database = Database.connect(url)
  return {
    url,
    database,
    async reset() {
      const { rows } = await pool.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      )
      if (rows.length === 0) return
      const names = rows.map((row) => `"${row.tablename}"`).join(', ')
      await pool.query(`TRUNCATE ${names} CASCADE`)
    },
    async drop() {
      await database.onApplicationShutdown()
      await pool.end()
      // The server retires a backend a moment after its client hangs up.
      // Dropping first makes it send a FATAL to a socket nobody reads anymore,
      // which node-postgres reports as an unhandled error.
      for (let i = 0; i < 100; i += 1) {
        const { rows } = await admin.query<{ n: number }>(
          'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1',
          [name],
        )
        if (rows[0]?.n === 0) break
        await sleep(20)
      }
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`)
      await admin.end()
    },
  }
}

/** `describe` for a suite that needs one migrated, emptied-per-test database. */
export function describeWithDatabase(
  title: string,
  body: (current: () => TestDatabase) => void,
) {
  describe.skipIf(!hasTestDatabase)(title, () => {
    let database: TestDatabase
    beforeAll(async () => {
      database = await createTestDatabase()
    })
    afterAll(async () => {
      await database?.drop()
    })
    beforeEach(async () => {
      await database.reset()
    })
    body(() => database)
  })
}
