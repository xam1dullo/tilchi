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
): Limiter {
  const hits = new Map<string, number[]>()
  return {
    hit(key) {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return Math.ceil(((recent[0] ?? t) + windowMs - t) / 1000)
      }
      recent.push(t)
      hits.set(key, recent)
      if (hits.size > 5000) {
        for (const [k, v] of hits) {
          if (v.every((at) => t - at >= windowMs)) hits.delete(k)
        }
      }
      return 0
    },
  }
}
