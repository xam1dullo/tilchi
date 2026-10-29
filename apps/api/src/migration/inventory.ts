export type InventoryRecord = {
  sourceInstance: string
  sourceTable: string
  sourceKey: string
  state: 'active' | 'deleted'
  fingerprint: string
}

export type Reconciliation = {
  added: number
  missing: number
  changed: number
  unchanged: number
  deleted: number
  restored: number
}

/**
 * Compare complete snapshots without accessing a live system. Fingerprints must
 * be SHA-256 of consistently canonicalized record contents, including owner and
 * relevant metadata. This function does not capture data or verify completeness.
 * `deleted` and `restored` are subsets of `changed`, not additional records.
 */
export function reconcileSnapshots(
  before: readonly InventoryRecord[],
  after: readonly InventoryRecord[],
): Reconciliation {
  const summary: Reconciliation = {
    added: 0,
    missing: 0,
    changed: 0,
    unchanged: 0,
    deleted: 0,
    restored: 0,
  }
  const index = (rows: readonly InventoryRecord[]) => {
    if (!Array.isArray(rows)) throw new Error('invalid inventory snapshot')
    const result = new Map<string, InventoryRecord>()
    for (const row of rows) {
      if (
        !row ||
        typeof row !== 'object' ||
        Array.isArray(row) ||
        typeof row.sourceInstance !== 'string' ||
        !row.sourceInstance.trim() ||
        typeof row.sourceTable !== 'string' ||
        !row.sourceTable.trim() ||
        typeof row.sourceKey !== 'string' ||
        !row.sourceKey.trim() ||
        (row.state !== 'active' && row.state !== 'deleted') ||
        typeof row.fingerprint !== 'string' ||
        !/^[0-9a-f]{64}$/.test(row.fingerprint)
      )
        throw new Error('invalid inventory record')
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
  const previous = index(before)
  const current = index(after)
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
