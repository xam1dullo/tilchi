import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyInitData } from './init-data'

const TOKEN = 'TEST_BOT_TOKEN'
const NOW = 2_000_000

function sign(fields: Record<string, string>, token = TOKEN) {
  const check = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(check).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}

const user = JSON.stringify({ id: 7, first_name: 'Ali', last_name: 'V' })
const fresh = { auth_date: String(NOW - 10), user }

describe('verifyInitData', () => {
  it('accepts a fresh payload signed with the bot token', () => {
    expect(verifyInitData(sign(fresh), TOKEN, NOW)).toEqual({
      telegramUserId: '7',
      name: 'Ali V',
    })
  })

  it('rejects a payload signed with another token or tampered after signing', () => {
    expect(verifyInitData(sign(fresh, 'OTHER'), TOKEN, NOW)).toBeNull()
    const tampered = sign(fresh).replace('Ali', 'Eve')
    expect(verifyInitData(tampered, TOKEN, NOW)).toBeNull()
  })

  it('rejects a stale or future auth_date', () => {
    const stale = { auth_date: String(NOW - 3601), user }
    const future = { auth_date: String(NOW + 120), user }
    expect(verifyInitData(sign(stale), TOKEN, NOW)).toBeNull()
    expect(verifyInitData(sign(future), TOKEN, NOW)).toBeNull()
  })

  it('fails closed without a bot token, hash, or user', () => {
    expect(verifyInitData(sign(fresh), '', NOW)).toBeNull()
    expect(verifyInitData('auth_date=1&user=%7B%7D', TOKEN, NOW)).toBeNull()
    expect(
      verifyInitData(sign({ auth_date: String(NOW) }), TOKEN, NOW),
    ).toBeNull()
    expect(
      verifyInitData(
        sign({ auth_date: String(NOW), user: '{"id":"x"}' }),
        TOKEN,
        NOW,
      ),
    ).toBeNull()
  })
})
