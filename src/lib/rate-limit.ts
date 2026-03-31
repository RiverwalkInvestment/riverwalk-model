/**
 * Simple in-memory rate limiter.
 * Works per serverless instance — not globally distributed, but stops abuse
 * on warm instances which handle the vast majority of traffic.
 */
const store = new Map<string, { count: number; resetAt: number }>()

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * @param key      Unique identifier (e.g. userId + route)
 * @param max      Maximum calls allowed in the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= max) return false

  entry.count++
  return true
}
