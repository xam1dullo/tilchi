import type { OnApplicationShutdown } from '@nestjs/common'
import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { databaseUrl } from '../config'
import { runMigrations } from './migrations'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>

/** One pool for the whole API; repositories take `db` from here. */
export class Database implements OnApplicationShutdown {
  private constructor(
    readonly db: Db,
    private readonly pool: Pool,
  ) {}

  static connect(url: string) {
    const pool = new Pool({ connectionString: url })
    // An idle client that loses its server must not crash the process; the
    // pool drops it and the next query opens a fresh one.
    pool.on('error', (error) => {
      console.error('postgres: idle client error', error.message)
    })
    return new Database(drizzle(pool, { schema }), pool)
  }

  /**
   * Nest provider factory. In development it applies the migrations first, so
   * `docker compose up` works without a separate step. Everywhere else the
   * deploy runs `dist/db/migrate.js` before the new containers start.
   */
  static async open(env: Record<string, string | undefined> = process.env) {
    const url = databaseUrl(env)
    if (env.NODE_ENV === 'development') await runMigrations(url)
    return Database.connect(url)
  }

  async onApplicationShutdown() {
    await this.pool.end()
  }
}
