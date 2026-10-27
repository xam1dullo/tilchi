import { Logger } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'
import * as schema from './schema'

// Services depend on this shape, so node-postgres in production and PGlite in
// tests are interchangeable.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export const DB = Symbol('tilchi.db')

// Postgres dropping an idle connection (restart, failover) reaches the pool as
// an 'error' event. Unhandled, Node treats it as fatal: the API exits and every
// in-memory session goes with it. The pool already discards the broken client
// and opens a new one for the next query, so reporting it is all that is left.
export function survivePoolErrors(
  pool: Pool,
  warn: (message: string) => void,
): Pool {
  pool.on('error', (error) => warn(`idle connection lost: ${error.message}`))
  return pool
}

export function createDb(url: string): Db {
  const logger = new Logger('Database')
  const pool = survivePoolErrors(
    new Pool({ connectionString: url }),
    (message) => logger.warn(message),
  )
  return drizzle(pool, { schema })
}

export function databaseUrl(env: Record<string, string | undefined>) {
  const url = env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL is required')
  return url
}
