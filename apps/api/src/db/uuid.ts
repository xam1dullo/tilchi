const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ids reach the API as path segments and body fields. Postgres rejects a
 * malformed uuid with an error, which would surface as a 500 instead of the
 * 404 an unknown id has always been. Check before querying.
 */
export function isUuid(value: string) {
  return UUID.test(value)
}
