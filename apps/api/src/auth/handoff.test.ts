import { describe, expect, it } from 'vitest'
import {
  bindTelegramUser,
  bindingHash,
  claimHandoff,
  confirmByTelegramUser,
  newHandoff,
} from './handoff'
import { HANDOFF_TTL_MS } from './policy'

const T0 = 1_000_000
const alice = { telegramUserId: '111', name: 'Alice' }
const mallory = { telegramUserId: '666', name: 'Mallory' }

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('expected a value')
  return value
}

const fresh = () =>
  newHandoff({ id: 'h1', secret: 'browser-secret', context: 'ctx', now: T0 })
const bound = () => must(bindTelegramUser(fresh(), alice, T0 + 1))
const confirmed = () => must(confirmByTelegramUser(bound(), '111', T0 + 2))

describe('handoff', () => {
  it('stores only a hash of the browser binding secret', () => {
    const h = fresh()
    expect(h.bindingHash).toBe(bindingHash('browser-secret'))
    expect(JSON.stringify(h)).not.toContain('browser-secret')
  })

  it('does not release a claim before the bot confirmed', () => {
    expect(claimHandoff(fresh(), 'browser-secret', T0 + 1)).toEqual({
      kind: 'waiting',
    })
    expect(claimHandoff(bound(), 'browser-secret', T0 + 2)).toEqual({
      kind: 'waiting',
    })
  })

  it('releases the confirmed telegram user to the starting browser only', () => {
    expect(claimHandoff(confirmed(), 'browser-secret', T0 + 3)).toEqual({
      kind: 'ok',
      telegramUserId: '111',
      name: 'Alice',
    })
    expect(claimHandoff(confirmed(), 'other-secret', T0 + 3)).toEqual({
      kind: 'wrong_browser',
    })
    expect(claimHandoff(confirmed(), undefined, T0 + 3)).toEqual({
      kind: 'wrong_browser',
    })
  })

  it('binds the first telegram user and refuses a second one', () => {
    expect(bindTelegramUser(bound(), mallory, T0 + 2)).toBeNull()
    expect(bindTelegramUser(bound(), alice, T0 + 2)).toEqual(bound())
  })

  it('only the bound telegram user can confirm', () => {
    expect(confirmByTelegramUser(bound(), '666', T0 + 2)).toBeNull()
    expect(confirmByTelegramUser(fresh(), '111', T0 + 2)).toBeNull()
  })

  it('expires after the handoff ttl for every step', () => {
    const late = T0 + HANDOFF_TTL_MS + 1
    expect(bindTelegramUser(fresh(), alice, late)).toBeNull()
    expect(confirmByTelegramUser(bound(), '111', late)).toBeNull()
    expect(claimHandoff(confirmed(), 'browser-secret', late)).toEqual({
      kind: 'expired',
    })
  })
})
