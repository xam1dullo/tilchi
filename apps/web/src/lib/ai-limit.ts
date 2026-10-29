export type Limiter = {
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
  return {
    hit(key) {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs)
      if (recent.length >= max) {
        remember(key, recent)
        return Math.ceil(((recent[0] ?? t) + windowMs - t) / 1000)
      }
      recent.push(t)
      remember(key, recent)
      return 0
    },
  }
}
