import { drizzle } from 'drizzle-orm/node-postgres'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'
import * as schema from './schema'

// Services depend on this shape, so node-postgres in production and PGlite in
// tests are interchangeable.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export const DB = Symbol('tilchi.db')

export function createDb(url: string): Db {
  const pool = new Pool({ connectionString: url })
  return drizzle(pool, { schema })
}

export function databaseUrl(env: Record<string, string | undefined>) {
  const url = env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL is required')
  return url
}
