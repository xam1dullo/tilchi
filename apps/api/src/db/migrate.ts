import { runMigrations } from './migrations'

/** `node dist/db/migrate.js`: apply every committed migration, or exit non-zero. */
export const finished = run(process.env)

async function run(env: NodeJS.ProcessEnv) {
  try {
    const url = env.DATABASE_URL?.trim()
    if (!url) throw new Error('DATABASE_URL is required')
    await runMigrations(url)
    console.log('migrate: done')
  } catch (error) {
    console.error('migrate: failed', error)
    process.exitCode = 1
  }
}
