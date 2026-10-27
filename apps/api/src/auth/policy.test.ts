import { describe, expect, it } from 'vitest'
import {
  AUTH_START_IP_LIMIT,
  AUTH_START_TELEGRAM_LIMIT,
  HANDOFF_COOKIE,
  SESSION_COOKIE,
  bearerSessionRejected,
  clearHandoffCookieHeader,
  confirmAvailable,
  cookieHeader,
  decideAuthStart,
  handoffCookieHeader,
  isRole,
  readCookie,
} from './policy'

describe('decideAuthStart', () => {
  it('allows a caller under both limits', () => {
    expect(decideAuthStart({ ipHits: 0, telegramHits: 0 })).toBe('allow')
    expect(
      decideAuthStart({ ipHits: AUTH_START_IP_LIMIT - 1, telegramHits: 0 }),
    ).toBe('allow')
  })

  it('blocks the ip before the telegram key', () => {
    expect(
      decideAuthStart({
        ipHits: AUTH_START_IP_LIMIT,
        telegramHits: AUTH_START_TELEGRAM_LIMIT,
      }),
    ).toBe('ip')
  })

  it('blocks a telegram key at three hits in the window', () => {
    expect(
      decideAuthStart({ ipHits: 1, telegramHits: AUTH_START_TELEGRAM_LIMIT }),
    ).toBe('telegram')
  })
})

describe('session cookie', () => {
  it('uses the host-prefixed name and the locked attributes', () => {
    const header = cookieHeader('abc', 60)
    expect(header.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('Secure')
    expect(header).toContain('SameSite=Lax')
    expect(header).toContain('Path=/')
    expect(header).not.toContain('Domain=')
  })
})

describe('bearerSessionRejected', () => {
  it('rejects a bearer header and ignores other schemes', () => {
    expect(bearerSessionRejected('Bearer abc')).toBe(true)
    expect(bearerSessionRejected('bearer abc')).toBe(true)
    expect(bearerSessionRejected(undefined)).toBe(false)
  })
})

describe('isRole', () => {
  it('accepts learner, teacher, and admin only', () => {
    expect(isRole('learner')).toBe(true)
    expect(isRole('teacher')).toBe(true)
    expect(isRole('admin')).toBe(true)
    expect(isRole('parent')).toBe(false)
  })
})

describe('handoff cookie', () => {
  it('is host-prefixed, HttpOnly, Secure, Lax, and never carries a Domain', () => {
    const header = handoffCookieHeader('secret', 300)
    expect(header.startsWith(`${HANDOFF_COOKIE}=secret`)).toBe(true)
    for (const part of [
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=300',
    ]) {
      expect(header).toContain(part)
    }
    expect(header).not.toContain('Domain=')
    expect(clearHandoffCookieHeader()).toContain('Max-Age=0')
  })
})

describe('readCookie', () => {
  it('reads a named cookie and survives malformed encoding', () => {
    expect(readCookie('a=1; __Host-tilchi_sid=abc', SESSION_COOKIE)).toBe('abc')
    expect(
      readCookie(`${SESSION_COOKIE}=%E0%A4%A`, SESSION_COOKIE),
    ).toBeUndefined()
    expect(readCookie(undefined, SESSION_COOKIE)).toBeUndefined()
  })
})

describe('confirmAvailable', () => {
  it('refuses production until the webhook secret makes the bot path usable', () => {
    const prod = { nodeEnv: 'production' }
    expect(confirmAvailable({ ...prod, webhookSecret: undefined })).toBe(false)
    expect(confirmAvailable({ ...prod, webhookSecret: '  ' })).toBe(false)
    expect(confirmAvailable({ ...prod, webhookSecret: 's' })).toBe(true)
    expect(
      confirmAvailable({ nodeEnv: 'development', webhookSecret: undefined }),
    ).toBe(true)
  })
})
