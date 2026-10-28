export const MAX_ATTEMPTS = 8
const BASE_MS = 30_000
const CAP_MS = 60 * 60 * 1000

/** Delay after failed attempt number `attempts`: 30 s, 1 min, 2 min ... capped at 1 h. */
export const backoffMs = (attempts: number) =>
  Math.min(BASE_MS * 2 ** Math.max(0, attempts - 1), CAP_MS)

export const isExhausted = (attempts: number) => attempts >= MAX_ATTEMPTS
