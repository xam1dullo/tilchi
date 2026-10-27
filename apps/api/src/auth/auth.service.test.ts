import { describe, expect, it } from 'vitest'
import { AuthService } from './auth.service'
import { HANDOFF_TTL_MS } from './policy'

function started(auth: AuthService, now: number) {
  return auth.start({ ip: '203.0.113.1', now })
}

describe('AuthService handoff', () => {
  it('waits until the bot confirms, then opens one session', () => {
    const auth = new AuthService()
    const { handoffId, claim } = started(auth, 0)
    expect(auth.claim(claim, 1).status).toBe('waiting')
    expect(auth.confirm(handoffId, 'tg-1', 2)).toBe(true)
    const opened = auth.claim(claim, 3)
    expect(opened.status).toBe('confirmed')
    if (opened.status !== 'confirmed') return
    expect(auth.read(opened.token, 4)?.userId).toBeDefined()
    expect(auth.claim(claim, 5).status).toBe('expired')
  })

  it('gives the same telegram user the same user id across devices', () => {
    const auth = new AuthService()
    const ids = [0, 1].map((now) => {
      const { handoffId, claim } = started(auth, now)
      auth.confirm(handoffId, 'tg-7', now)
      const opened = auth.claim(claim, now)
      return opened.status === 'confirmed'
        ? auth.read(opened.token, now)?.userId
        : undefined
    })
    expect(ids[0]).toBeDefined()
    expect(ids[0]).toBe(ids[1])
  })

  it('expires an unclaimed handoff after its ttl', () => {
    const auth = new AuthService()
    const { handoffId, claim } = started(auth, 0)
    expect(auth.confirm(handoffId, 'tg-1', HANDOFF_TTL_MS + 1)).toBe(false)
    expect(auth.claim(claim, HANDOFF_TTL_MS + 1).status).toBe('expired')
  })

  it('rejects a claim whose secret does not match', () => {
    const auth = new AuthService()
    const { handoffId } = started(auth, 0)
    auth.confirm(handoffId, 'tg-1', 1)
    expect(auth.claim(`${handoffId}.wrong`, 2).status).toBe('expired')
    expect(auth.claim(undefined, 2).status).toBe('expired')
  })
})
