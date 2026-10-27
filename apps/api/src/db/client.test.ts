import { Pool } from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { survivePoolErrors } from './client'

const dropped = () =>
  new Error('terminating connection due to administrator command')

// A pool that never queries opens no connection, so no database is needed.
const pools: Pool[] = []
function newPool() {
  const pool = new Pool({ connectionString: 'postgres://nobody@127.0.0.1:1/x' })
  pools.push(pool)
  return pool
}

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.end()))
})

describe('survivePoolErrors', () => {
  it('reports a dropped idle connection instead of crashing the process', () => {
    const warn = vi.fn()
    const pool = survivePoolErrors(newPool(), warn)

    expect(() => pool.emit('error', dropped())).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      'idle connection lost: terminating connection due to administrator command',
    )
  })

  it('keeps reporting every later drop', () => {
    const warn = vi.fn()
    const pool = survivePoolErrors(newPool(), warn)

    pool.emit('error', dropped())
    pool.emit('error', dropped())
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('is needed: a pool without it throws the same event', () => {
    expect(() => newPool().emit('error', dropped())).toThrow(
      'terminating connection',
    )
  })
})
