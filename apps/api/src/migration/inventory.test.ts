import { describe, expect, it } from 'vitest'
import {
  reconcileSnapshots,
  type InventoryRecord,
  type InventoryScope,
  type InventorySnapshot,
} from './inventory'

const scopeA = { sourceInstance: 'device-a', sourceTable: 'lessons' }
const scopeB = { sourceInstance: 'device-b', sourceTable: 'lessons' }
const record: InventoryRecord = {
  ...scopeA,
  sourceKey: ['owner-a', 'deck-1'],
  state: 'active',
  fingerprint: 'a'.repeat(64),
}
const capture = (
  records: readonly InventoryRecord[],
  scopes: readonly InventoryScope[] = [scopeA],
): InventorySnapshot => ({ complete: true, scopes, records })

describe('snapshot reconciliation', () => {
  it('detects a record missing from a complete final capture', () => {
    expect(
      reconcileSnapshots([scopeA], capture([record]), capture([])),
    ).toEqual({
      added: 0,
      missing: 1,
      changed: 0,
      unchanged: 0,
      deleted: 0,
      restored: 0,
    })
  })

  it('distinguishes an incomplete capture from a complete empty scope', () => {
    const empty = capture([])
    expect(() =>
      reconcileSnapshots([scopeA], { ...empty, complete: false }, empty),
    ).toThrow(/incomplete/i)
    expect(() =>
      reconcileSnapshots([scopeA], empty, { ...empty, complete: false }),
    ).toThrow(/incomplete/i)
    expect(reconcileSnapshots([scopeA], empty, empty)).toEqual({
      added: 0,
      missing: 0,
      changed: 0,
      unchanged: 0,
      deleted: 0,
      restored: 0,
    })
  })

  it('rejects missing, extra or undeclared scopes without exposing values', () => {
    const expected = [scopeA, scopeB]
    expect(() =>
      reconcileSnapshots(
        expected,
        capture([], expected),
        capture([], [scopeA]),
      ),
    ).toThrow(/incomplete/i)
    expect(() =>
      reconcileSnapshots([scopeA], capture([], expected), capture([])),
    ).toThrow(/incomplete/i)
    expect(() =>
      reconcileSnapshots(
        [scopeA],
        capture([{ ...record, sourceInstance: 'private-device' }]),
        capture([]),
      ),
    ).toThrow(/outside captured scope/i)
    expect(() => reconcileSnapshots([], capture([]), capture([]))).toThrow(
      /invalid/i,
    )
  })

  it('rejects duplicate scopes and duplicate keys in either capture', () => {
    expect(() =>
      reconcileSnapshots([scopeA, scopeA], capture([]), capture([])),
    ).toThrow(/duplicate/i)
    expect(() =>
      reconcileSnapshots([scopeA], capture([], [scopeA, scopeA]), capture([])),
    ).toThrow(/duplicate/i)
    const privateRow = { ...record, sourceKey: ['sensitive-record'] }
    expect(() =>
      reconcileSnapshots(
        [scopeA],
        capture([privateRow, privateRow]),
        capture([]),
      ),
    ).toThrow(/duplicate/i)
    expect(() =>
      reconcileSnapshots(
        [scopeA],
        capture([]),
        capture([privateRow, privateRow]),
      ),
    ).toThrow(/duplicate/i)
    try {
      reconcileSnapshots(
        [scopeA],
        capture([]),
        capture([privateRow, privateRow]),
      )
    } catch (error) {
      expect(String(error)).toMatch(/duplicate/i)
      expect(String(error)).not.toContain('sensitive-record')
    }
  })

  it('uses a collision-safe key for composite source identifiers', () => {
    const scope1 = { sourceInstance: 'a:b', sourceTable: 'c' }
    const scope2 = { sourceInstance: 'a', sourceTable: 'b:c' }
    const first = { ...record, ...scope1 }
    const second = { ...record, ...scope2 }
    const scopes = [scope1, scope2]
    expect(
      reconcileSnapshots(
        scopes,
        capture([first], scopes),
        capture([second], scopes),
      ),
    ).toMatchObject({ added: 1, missing: 1, unchanged: 0 })
  })

  it('keeps identical lesson ids from different owners separate', () => {
    const first = { ...record, sourceKey: ['owner-a', 'shared-id'] }
    const second = { ...record, sourceKey: ['owner-b', 'shared-id'] }
    expect(
      reconcileSnapshots([scopeA], capture([first, second]), capture([first])),
    ).toMatchObject({
      missing: 1,
      unchanged: 1,
    })
  })

  it('distinguishes sources, changes, tombstones and missing records', () => {
    const scopes = [scopeA, scopeB]
    const before = [
      record,
      { ...record, ...scopeB },
      { ...record, sourceKey: ['owner-a', 'deck-2'] },
      {
        ...record,
        sourceKey: ['owner-a', 'deck-3'],
        state: 'deleted' as const,
      },
      { ...record, sourceKey: ['owner-a', 'deck-4'] },
    ]
    const after = [
      record,
      { ...record, ...scopeB, fingerprint: 'b'.repeat(64) },
      {
        ...record,
        sourceKey: ['owner-a', 'deck-2'],
        state: 'deleted' as const,
      },
      { ...record, sourceKey: ['owner-a', 'deck-3'] },
      { ...record, sourceKey: ['owner-a', 'deck-5'] },
    ]
    const result = {
      added: 1,
      missing: 1,
      changed: 3,
      unchanged: 1,
      deleted: 1,
      restored: 1,
    }
    expect(
      reconcileSnapshots(
        scopes,
        capture(before, scopes),
        capture(after, scopes),
      ),
    ).toEqual(result)
    expect(
      reconcileSnapshots(
        scopes,
        capture(before, scopes),
        capture(after, scopes),
      ),
    ).toEqual(result)
  })

  it('rejects malformed records without revealing their source keys', () => {
    for (const invalid of [
      { ...record, sourceInstance: '' },
      { ...record, sourceTable: '  ' },
      { ...record, sourceKey: 1 },
      { ...record, sourceKey: [] },
      { ...record, sourceKey: ['owner-a', ' '] },
      { ...record, sourceKey: new Array(1) },
      { ...record, state: 'unknown' },
      { ...record, fingerprint: '' },
      { ...record, fingerprint: 'not-a-sha256' },
      null,
    ]) {
      const invalidCapture = capture([invalid] as never)
      expect(() =>
        reconcileSnapshots([scopeA], invalidCapture, capture([])),
      ).toThrow(/invalid/i)
      try {
        reconcileSnapshots([scopeA], invalidCapture, capture([]))
      } catch (error) {
        expect(String(error)).not.toContain('deck-1')
      }
    }
    expect(() =>
      reconcileSnapshots([scopeA], null as never, capture([])),
    ).toThrow(/invalid/i)
  })
})
