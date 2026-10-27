export const SESSION_COOKIE = '__Host-tilchi_sid'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const HANDOFF_TTL_MS = 5 * 60 * 1000
export const SESSION_CACHE_TTL_SECONDS = 5 * 60
export const AUTH_START_IP_LIMIT = 5
export const AUTH_START_TELEGRAM_LIMIT = 3
export const RATE_WINDOW_MS = 60_000

export const roles = ['learner', 'teacher', 'admin'] as const
export type Role = (typeof roles)[number]

export function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value)
}

export type RateDecision = 'allow' | 'ip' | 'telegram'

export function decideAuthStart(input: {
  ipHits: number
  telegramHits: number
}): RateDecision {
  if (input.ipHits >= AUTH_START_IP_LIMIT) return 'ip'
  if (input.telegramHits >= AUTH_START_TELEGRAM_LIMIT) return 'telegram'
  return 'allow'
}

export function cookieHeader(token: string, maxAgeSeconds: number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`
}

export function clearCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export function readCookie(header: string | undefined, name: string) {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export function bearerSessionRejected(authorization: string | undefined) {
  return authorization?.toLowerCase().startsWith('bearer ') ?? false
}
