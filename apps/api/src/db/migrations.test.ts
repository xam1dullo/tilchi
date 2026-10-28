import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Pool } from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTestDatabase,
  describeWithDatabase,
  hasTestDatabase,
} from '../test/postgres'
import { MIGRATIONS_FOLDER, runMigrations } from './migrations'

async function query<T extends object>(url: string, sql: string) {
  const pool = new Pool({ connectionString: url })
  try {
    return (await pool.query<T>(sql)).rows
  } finally {
    await pool.end()
  }
}

const tables = async (url: string) =>
  (
    await query<{ tablename: string }>(
      url,
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`,
    )
  ).map((row) => row.tablename)

const applied = async (url: string) =>
  Number(
    (
      await query<{ n: string }>(
        url,
        'SELECT count(*) AS n FROM drizzle.__drizzle_migrations',
      )
    )[0]?.n,
  )

/** The committed migrations plus one more entry that is not valid SQL. */
async function withBrokenMigration() {
  const dir = await mkdtemp(join(tmpdir(), 'tilchi-broken-'))
  await cp(MIGRATIONS_FOLDER, dir, { recursive: true })
  const journalPath = join(dir, 'meta', '_journal.json')
  const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
    entries: { idx: number; when: number; tag: string }[]
  }
  const last = journal.entries[journal.entries.length - 1]
  journal.entries.push({
    ...last,
    idx: last.idx + 1,
    when: last.when + 1,
    tag: '9999_broken',
  })
  await writeFile(journalPath, JSON.stringify(journal))
  await writeFile(join(dir, '9999_broken.sql'), 'THIS IS NOT SQL;')
  return dir
}

describe('runMigrations without a journal', () => {
  it('fails loudly instead of succeeding silently', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'tilchi-empty-'))
    try {
      await expect(
        runMigrations('postgres://127.0.0.1:1/never', empty),
      ).rejects.toThrow(/no migration journal/)
    } finally {
      await rm(empty, { recursive: true })
    }
  })

  it('has a committed journal with at least one migration', async () => {
    const journal = JSON.parse(
      await readFile(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: unknown[] }
    expect(journal.entries.length).toBeGreaterThan(0)
  })
})

describeWithDatabase('runMigrations on a real database', (current) => {
  it('builds the whole v1 schema from an empty database', async () => {
    expect(await tables(current().url)).toEqual([
      'attendance_events',
      'group_members',
      'groups',
      'lessons',
      'meetings',
      'notifications',
      'outbox',
      'outbox_deliveries',
      'sessions',
      'users',
    ])
  })

  it('is a no-op the second time', async () => {
    const before = await applied(current().url)
    await runMigrations(current().url)
    expect(await applied(current().url)).toBe(before)
  })

  it('rejects a failing migration and leaves the schema as it was', async () => {
    const dir = await withBrokenMigration()
    try {
      await expect(runMigrations(current().url, dir)).rejects.toThrow()
      expect(await tables(current().url)).toContain('users')
    } finally {
      await rm(dir, { recursive: true })
    }
  })
})

describe.skipIf(!hasTestDatabase)(
  'a failing migration on an empty database',
  () => {
    it('applies nothing, not even the valid ones before it', async () => {
      const fresh = await createTestDatabase({ migrate: false })
      const dir = await withBrokenMigration()
      try {
        await expect(runMigrations(fresh.url, dir)).rejects.toThrow()
        expect(await tables(fresh.url)).toEqual([])
      } finally {
        await rm(dir, { recursive: true })
        await fresh.drop()
      }
    })
  },
)

describe('the migrate CLI', () => {
  afterEach(() => {
    process.exitCode = undefined
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('exits non-zero and says why when DATABASE_URL is not set', async () => {
    vi.stubEnv('DATABASE_URL', '')
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { finished } = await import('./migrate')
    await finished
    expect(process.exitCode).toBe(1)
    expect(String(logged.mock.calls[0])).toContain('DATABASE_URL is required')
  })

  it('exits non-zero when the database cannot be reached', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://127.0.0.1:1/never')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { finished } = await import('./migrate')
    await finished
    expect(process.exitCode).toBe(1)
  })
})

describe.skipIf(!hasTestDatabase)('the migrate CLI on a real database', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('applies the migrations and reports done', async () => {
    const fresh = await createTestDatabase({ migrate: false })
    vi.stubEnv('DATABASE_URL', fresh.url)
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const { finished } = await import('./migrate')
      await finished
      expect(process.exitCode).toBeUndefined()
      expect(logged).toHaveBeenCalledWith('migrate: done')
      expect(await tables(fresh.url)).toContain('users')
    } finally {
      await fresh.drop()
    }
  })
})
