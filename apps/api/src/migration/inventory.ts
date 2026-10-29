export type InventoryScope = {
  sourceInstance: string
  sourceTable: string
}

export type InventoryRecord = InventoryScope & {
  /** All primary-key parts, in schema order; no delimiter-based concatenation. */
  sourceKey: readonly string[]
  state: 'active' | 'deleted'
  fingerprint: string
}

export type InventorySnapshot = {
  complete: boolean
  scopes: readonly InventoryScope[]
  records: readonly InventoryRecord[]
}

export type Reconciliation = {
  added: number
  missing: number
  changed: number
  unchanged: number
  deleted: number
  restored: number
}

const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const scopeKey = (scope: InventoryScope) =>
  JSON.stringify([scope.sourceInstance, scope.sourceTable])

function indexScopes(scopes: readonly InventoryScope[]) {
  if (!Array.isArray(scopes)) throw new Error('invalid inventory scope')
  const result = new Set<string>()
  for (const scope of scopes) {
    if (
      !scope ||
      typeof scope !== 'object' ||
      Array.isArray(scope) ||
      !nonempty(scope.sourceInstance) ||
      !nonempty(scope.sourceTable)
    )
      throw new Error('invalid inventory scope')
    const key = scopeKey(scope)
    if (result.has(key)) throw new Error('duplicate inventory scope')
    result.add(key)
  }
  return result
}

function indexSnapshot(
  snapshot: InventorySnapshot,
  expected: ReadonlySet<string>,
) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
    throw new Error('invalid inventory snapshot')
  if (snapshot.complete !== true)
    throw new Error('incomplete inventory capture')
  const captured = indexScopes(snapshot.scopes)
  if (
    captured.size !== expected.size ||
    [...expected].some((scope) => !captured.has(scope))
  )
    throw new Error('incomplete inventory scope')
  if (!Array.isArray(snapshot.records))
    throw new Error('invalid inventory snapshot')

  const result = new Map<string, InventoryRecord>()
  for (const row of snapshot.records) {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      !nonempty(row.sourceInstance) ||
      !nonempty(row.sourceTable) ||
      !Array.isArray(row.sourceKey) ||
      row.sourceKey.length === 0 ||
      !Array.from(row.sourceKey).every(nonempty) ||
      (row.state !== 'active' && row.state !== 'deleted') ||
      typeof row.fingerprint !== 'string' ||
      !/^[0-9a-f]{64}$/.test(row.fingerprint)
    )
      throw new Error('invalid inventory record')
    if (!captured.has(scopeKey(row)))
      throw new Error('inventory record outside captured scope')
    const key = JSON.stringify([
      row.sourceInstance,
      row.sourceTable,
      row.sourceKey,
    ])
    if (result.has(key)) throw new Error('duplicate inventory key')
    result.set(key, row)
  }
  return result
}

/**
 * Compare declared-complete snapshots for the exact expected source scopes.
 * A capture adapter must establish completeness and compute SHA-256 over
 * consistently canonicalized relevant content, including owner and metadata.
 * This function cannot verify those attestations or certify cutover readiness.
 * deleted/restored are subsets of changed, not additional records.
 */
export function reconcileSnapshots(
  expectedScopes: readonly InventoryScope[],
  before: InventorySnapshot,
  after: InventorySnapshot,
): Reconciliation {
  const expected = indexScopes(expectedScopes)
  if (!expected.size) throw new Error('invalid inventory scope')
  const previous = indexSnapshot(before, expected)
  const current = indexSnapshot(after, expected)
  const summary: Reconciliation = {
    added: 0,
    missing: 0,
    changed: 0,
    unchanged: 0,
    deleted: 0,
    restored: 0,
  }
  for (const [key, old] of previous) {
    const next = current.get(key)
    if (!next) summary.missing++
    else if (old.state === next.state && old.fingerprint === next.fingerprint)
      summary.unchanged++
    else {
      summary.changed++
      if (old.state === 'active' && next.state === 'deleted') summary.deleted++
      if (old.state === 'deleted' && next.state === 'active') summary.restored++
    }
  }
  for (const key of current.keys()) if (!previous.has(key)) summary.added++
  return summary
}
