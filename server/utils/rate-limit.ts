import type { H3Event } from 'h3'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 30 // 30 requests per minute per IP

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000)

function getClientIp(event: H3Event): string {
  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return getHeader(event, 'x-real-ip')
    ?? event.node.req.socket.remoteAddress
    ?? 'unknown'
}

/**
 * Simple in-memory sliding window rate limiter.
 * Returns null if allowed, or an object with retry info if rate limited.
 */
export function checkRateLimit(event: H3Event): { retryAfterSeconds: number } | null {
  const ip = getClientIp(event)
  const now = Date.now()

  let entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS }
    store.set(ip, entry)
    return null
  }

  entry.count++

  if (entry.count > MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
    return { retryAfterSeconds }
  }

  return null
}
