import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { databaseUrl } from './client'

// `node dist/db/migrate.js`: applies committed migrations, then exits.
// Image layout: /app/dist/db/migrate.js next to /app/drizzle.
async function run() {
  const pool = new Pool({ connectionString: databaseUrl(process.env) })
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: join(__dirname, '..', '..', 'drizzle'),
    })
  } finally {
    await pool.end()
  }
}

run().then(
  () => console.log('migrations applied'),
  (error) => {
    console.error(
      'migration failed:',
      error instanceof Error ? error.message : error,
    )
    process.exit(1)
  },
)
