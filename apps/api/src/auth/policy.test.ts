import { describe, expect, it } from 'vitest'
import {
  AUTH_START_IP_LIMIT,
  AUTH_START_TELEGRAM_LIMIT,
  HANDOFF_COOKIE,
  SESSION_COOKIE,
  bearerSessionRejected,
  cookieHeader,
  decideAuthStart,
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

describe('readCookie', () => {
  it('returns nothing for a malformed value instead of throwing', () => {
    expect(readCookie(`${SESSION_COOKIE}=%E0%A4%A`, SESSION_COOKIE)).toBe(
      undefined,
    )
    expect(readCookie(`a=1; ${SESSION_COOKIE}=x%20y`, SESSION_COOKIE)).toBe(
      'x y',
    )
  })
})

describe('handoff cookie', () => {
  it('uses its own host-prefixed name with the same attributes', () => {
    const header = cookieHeader('id.secret', 300, HANDOFF_COOKIE)
    expect(header.startsWith('__Host-tilchi_handoff=')).toBe(true)
    expect(header).toContain('HttpOnly; Secure; SameSite=Lax; Path=/')
  })
})
