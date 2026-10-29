export type Limiter = {
  /** Seconds to wait if a hit now would be over the limit, else 0. Records nothing. */
  check(key: string): number
  /** Records a hit. Returns seconds to wait when over the limit, else 0. */
  hit(key: string): number
}

/**
 * Sliding window per key, in memory. ponytail: v1 runs a single web instance,
 * so no shared store; move to Redis if the web tier is ever scaled out.
 */
export function createLimiter(
  max: number,
  windowMs: number,
  now: () => number = Date.now,
  maxKeys = 5000,
): Limiter {
  const hits = new Map<string, number[]>()
  // Map keeps insertion order: re-inserting on every hit makes the first key
  // the least recently used, so eviction is O(1) per extra key.
  const remember = (key: string, recent: number[]) => {
    hits.delete(key)
    hits.set(key, recent)
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next().value
      if (oldest === undefined) break
      hits.delete(oldest)
    }
  }
  const recentFor = (key: string, t: number) =>
    (hits.get(key) ?? []).filter((at) => t - at < windowMs)
  const waitFor = (recent: number[], t: number) =>
    recent.length >= max
      ? Math.ceil(((recent[0] ?? t) + windowMs - t) / 1000)
      : 0
  return {
    check(key) {
      const t = now()
      return waitFor(recentFor(key, t), t)
    },
    hit(key) {
      const t = now()
      const recent = recentFor(key, t)
      const wait = waitFor(recent, t)
      if (wait === 0) recent.push(t)
      remember(key, recent)
      return wait
    },
  }
}
