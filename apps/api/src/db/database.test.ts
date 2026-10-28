import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestDatabase,
  hasTestDatabase,
  type TestDatabase,
} from '../test/postgres'
import { Database } from './database'

const tables = async (database: Database) =>
  (
    await database.db.execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    )
  ).rows.map((row) => row.tablename)

describe('Database.open without a url', () => {
  afterEach(() => vi.restoreAllMocks())

  it('refuses to boot outside tests', async () => {
    await expect(Database.open({ NODE_ENV: 'development' })).rejects.toThrow(
      /DATABASE_URL is required/,
    )
  })

  it('never reaches a real server in tests', async () => {
    const database = await Database.open({ NODE_ENV: 'test' })
    await expect(database.db.execute(sql`select 1`)).rejects.toThrow()
    await database.onApplicationShutdown()
  })
})

describe.skipIf(!hasTestDatabase)('Database on a real server', () => {
  let fresh: TestDatabase
  beforeEach(async () => {
    fresh = await createTestDatabase({ migrate: false })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await fresh.drop()
  })

  it('applies the migrations when it boots in development', async () => {
    const database = await Database.open({
      NODE_ENV: 'development',
      DATABASE_URL: fresh.url,
    })
    try {
      expect(await tables(database)).toContain('users')
    } finally {
      await database.onApplicationShutdown()
    }
  })

  it('leaves the schema to the deploy step everywhere else', async () => {
    for (const NODE_ENV of ['production', 'test', undefined]) {
      const database = await Database.open({
        NODE_ENV,
        DATABASE_URL: fresh.url,
      })
      try {
        expect(await tables(database)).toEqual([])
      } finally {
        await database.onApplicationShutdown()
      }
    }
  })

  it('survives the server dropping an idle connection', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const database = Database.connect(fresh.url)
    await database.db.execute(sql`select 1`)
    const admin = new Pool({ connectionString: fresh.url, max: 1 })
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid()`,
    )
    await admin.end()
    await vi.waitFor(() => expect(logged).toHaveBeenCalled())
    const { rows } = await database.db.execute<{ one: number }>(
      sql`select 1 as one`,
    )
    expect(rows).toEqual([{ one: 1 }])
    await database.onApplicationShutdown()
  })

  it('closes its pool on shutdown', async () => {
    const database = Database.connect(fresh.url)
    await database.onApplicationShutdown()
    await expect(database.db.execute(sql`select 1`)).rejects.toThrow()
  })
})
