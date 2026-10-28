import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

// dist/db/migrate.js -> <app>/drizzle, both in the repo and in the image.
const migrationsFolder = join(__dirname, '..', '..', 'drizzle')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  if (!existsSync(join(migrationsFolder, 'meta', '_journal.json'))) {
    console.log('migrate: no migrations generated yet')
    return
  }
  const pool = new Pool({ connectionString: url })
  try {
    await migrate(drizzle(pool), { migrationsFolder })
    console.log('migrate: done')
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
