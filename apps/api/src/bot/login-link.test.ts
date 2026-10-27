import { describe, expect, it } from 'vitest'
import {
  botUsername,
  loginDeepLink,
  loginPayload,
  parseLoginPayload,
} from './login-link'

const id = '0192f4c0-7a3e-7b11-8c2d-3f4a5b6c7d8e'

describe('loginDeepLink', () => {
  it('opens the production bot with the handoff in the start payload', () => {
    expect(loginDeepLink(id, {})).toBe(
      `https://t.me/tilchiuz_bot?start=login_${id}`,
    )
  })

  it('uses the bot named in TELEGRAM_BOT_USERNAME', () => {
    expect(
      loginDeepLink(id, { TELEGRAM_BOT_USERNAME: 'tilchi_staging_bot' }),
    ).toBe(`https://t.me/tilchi_staging_bot?start=login_${id}`)
  })

  it('refuses a username that is not a telegram handle', () => {
    for (const bad of [
      'x',
      'has space_bot',
      'a/b_bot',
      '@tilchiuz_bot',
      '1abcd_bot',
    ]) {
      expect(() => botUsername({ TELEGRAM_BOT_USERNAME: bad })).toThrow(
        'TELEGRAM_BOT_USERNAME',
      )
    }
  })

  it('keeps the start parameter inside the 64 character telegram limit', () => {
    expect(loginPayload(id).length).toBeLessThanOrEqual(64)
  })
})

describe('parseLoginPayload', () => {
  it('returns the handoff id of a login payload', () => {
    expect(parseLoginPayload(loginPayload(id))).toBe(id)
  })

  it('ignores other funnels and malformed ids', () => {
    expect(parseLoginPayload('ielts_orta')).toBeUndefined()
    expect(parseLoginPayload('login_')).toBeUndefined()
    expect(parseLoginPayload(`login_${id.toUpperCase()}`)).toBeUndefined()
    expect(parseLoginPayload(`login_${id}x`)).toBeUndefined()
    expect(parseLoginPayload('login_../../etc')).toBeUndefined()
  })
})
