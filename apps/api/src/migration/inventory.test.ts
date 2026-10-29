import { describe, expect, it } from 'vitest'
import { reconcileSnapshots } from './inventory'

describe('snapshot reconciliation', () => {
  it('detects a record missing from the final capture', () => {
    const before = [
      {
        sourceInstance: 'test-db',
        sourceTable: 'lessons',
        sourceKey: 'deck-1',
        state: 'active' as const,
        fingerprint: 'a'.repeat(64),
      },
    ]
    expect(reconcileSnapshots(before, [])).toEqual({
      added: 0,
      missing: 1,
      changed: 0,
      unchanged: 0,
      deleted: 0,
      restored: 0,
    })
  })

  it('rejects duplicate keys without exposing the source key', () => {
    const row = {
      sourceInstance: 'device-a',
      sourceTable: 'lessons',
      sourceKey: 'sensitive-record',
      state: 'active' as const,
      fingerprint: 'a'.repeat(64),
    }
    expect(() => reconcileSnapshots([row, row], [])).toThrow(/duplicate/i)
    expect(() => reconcileSnapshots([], [row, row])).toThrow(/duplicate/i)
    try {
      reconcileSnapshots([row, row], [])
    } catch (error) {
      expect(String(error)).not.toContain('sensitive-record')
    }
  })

  it('uses a collision-safe key for composite source identifiers', () => {
    const record = {
      sourceInstance: 'a:b',
      sourceTable: 'c',
      sourceKey: 'd',
      state: 'active' as const,
      fingerprint: 'a'.repeat(64),
    }
    const different = { ...record, sourceInstance: 'a', sourceTable: 'b:c' }
    expect(reconcileSnapshots([record], [different])).toMatchObject({
      added: 1,
      missing: 1,
      unchanged: 0,
    })
  })

  it('distinguishes separate sources, changes, tombstones and missing records', () => {
    const record = {
      sourceInstance: 'device-a',
      sourceTable: 'lessons',
      sourceKey: 'deck-1',
      state: 'active' as const,
      fingerprint: 'a'.repeat(64),
    }
    const before = [
      record,
      { ...record, sourceInstance: 'device-b' },
      { ...record, sourceKey: 'deck-2' },
      { ...record, sourceKey: 'deck-3', state: 'deleted' as const },
      { ...record, sourceKey: 'deck-4' },
    ]
    const after = [
      record,
      { ...record, sourceInstance: 'device-b', fingerprint: 'b'.repeat(64) },
      { ...record, sourceKey: 'deck-2', state: 'deleted' as const },
      { ...record, sourceKey: 'deck-3' },
      { ...record, sourceKey: 'deck-5' },
    ]
    const expected = {
      added: 1,
      missing: 1,
      changed: 3,
      unchanged: 1,
      deleted: 1,
      restored: 1,
    }
    expect(reconcileSnapshots(before, after)).toEqual(expected)
    expect(reconcileSnapshots(before, after)).toEqual(expected)
  })

  it('rejects malformed records and snapshots without revealing values', () => {
    const valid = {
      sourceInstance: 'device-a',
      sourceTable: 'lessons',
      sourceKey: 'private-id',
      state: 'active' as const,
      fingerprint: 'a'.repeat(64),
    }
    for (const invalid of [
      { ...valid, sourceInstance: '' },
      { ...valid, sourceTable: '  ' },
      { ...valid, sourceKey: 1 },
      { ...valid, state: 'unknown' },
      { ...valid, fingerprint: '' },
      { ...valid, fingerprint: 'not-a-sha256' },
      null,
    ]) {
      expect(() => reconcileSnapshots([invalid] as never, [])).toThrow(
        /invalid/i,
      )
      try {
        reconcileSnapshots([invalid] as never, [])
      } catch (error) {
        expect(String(error)).not.toContain('private-id')
      }
    }
    expect(() => reconcileSnapshots(null as never, [])).toThrow(/invalid/i)
  })
})
