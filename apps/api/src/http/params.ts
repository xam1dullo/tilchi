import { type Result, fail, ok } from './result'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Postgres rejects a malformed uuid with a 500-shaped error, so ids are
// checked (and lower-cased) before any query runs.
export function parseUuid(value: unknown, error = 'bad_id'): Result<string> {
  if (typeof value !== 'string' || !UUID.test(value)) return fail(400, error)
  return ok(value.toLowerCase())
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
