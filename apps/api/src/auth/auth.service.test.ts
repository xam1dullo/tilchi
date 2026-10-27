import { describe, expect, it } from 'vitest'
import { RoleAllowlist } from '../users/roles'
import { fakeUsers } from '../users/testing'
import { AuthService } from './auth.service'
import { HANDOFF_TTL_MS, RATE_WINDOW_MS, SESSION_TTL_MS } from './policy'

// Test-only peek at the in-memory maps, to prove they do not grow forever.
function sizes(auth: AuthService) {
  const inner = auth as unknown as {
    handoffs: Map<string, unknown>
    ipHits: Map<string, unknown>
  }
  return { handoffs: inner.handoffs.size, ipHits: inner.ipHits.size }
}

const roles = new RoleAllowlist(new Set(['900']), new Set(['500']))

function service(options?: Parameters<typeof fakeUsers>[0]) {
  return new AuthService(fakeUsers(options), roles)
}

function started(auth: AuthService, now: number) {
  return auth.start({ ip: '203.0.113.1', now })
}

async function signedIn(auth: AuthService, telegramId: string, now: number) {
  const { handoffId, claim } = started(auth, now)
  expect(await auth.confirm(handoffId, { id: telegramId }, now)).toBe(true)
  const opened = auth.claim(claim, now)
  if (opened.status !== 'confirmed') throw new Error(opened.status)
  return opened.token
}

describe('AuthService handoff', () => {
  it('waits until the bot confirms, then opens one session', async () => {
    const auth = service()
    const { handoffId, claim } = started(auth, 0)
    expect(auth.claim(claim, 1).status).toBe('waiting')
    expect(await auth.confirm(handoffId, { id: 'tg-1' }, 2)).toBe(true)
    const opened = auth.claim(claim, 3)
    expect(opened.status).toBe('confirmed')
    if (opened.status !== 'confirmed') return
    expect(auth.read(opened.token, 4)?.userId).toBeDefined()
    expect(auth.claim(claim, 5).status).toBe('expired')
  })

  it('gives the same telegram user the same user id across devices', async () => {
    const auth = service()
    const first = await signedIn(auth, 'tg-7', 0)
    const second = await signedIn(auth, 'tg-7', 1)
    expect(auth.read(first, 2)?.userId).toBeDefined()
    expect(auth.read(first, 2)?.userId).toBe(auth.read(second, 2)?.userId)
  })

  it('expires an unclaimed handoff after its ttl', async () => {
    const auth = service()
    const { handoffId, claim } = started(auth, 0)
    expect(
      await auth.confirm(handoffId, { id: 'tg-1' }, HANDOFF_TTL_MS + 1),
    ).toBe(false)
    expect(auth.claim(claim, HANDOFF_TTL_MS + 1).status).toBe('expired')
  })

  it('rejects a claim whose secret does not match', async () => {
    const auth = service()
    const { handoffId } = started(auth, 0)
    await auth.confirm(handoffId, { id: 'tg-1' }, 1)
    expect(auth.claim(`${handoffId}.wrong`, 2).status).toBe('expired')
    expect(auth.claim(undefined, 2).status).toBe('expired')
  })

  it('keeps the first telegram user who confirmed a handoff', async () => {
    const auth = service()
    const { handoffId, claim } = started(auth, 0)
    expect(await auth.confirm(handoffId, { id: 'tg-owner' }, 1)).toBe(true)
    expect(await auth.confirm(handoffId, { id: 'tg-other' }, 2)).toBe(false)
    const opened = auth.claim(claim, 3)
    if (opened.status !== 'confirmed') throw new Error(opened.status)
    const again = await signedIn(auth, 'tg-owner', 4)
    expect(auth.read(opened.token, 5)?.userId).toBe(auth.read(again, 5)?.userId)
  })

  it('keeps the first confirmer even while the user store is slow', async () => {
    const auth = service({ delayMs: 20 })
    const { handoffId, claim } = started(auth, 0)
    const [first, second] = await Promise.all([
      auth.confirm(handoffId, { id: 'tg-first' }, 1),
      auth.confirm(handoffId, { id: 'tg-second' }, 1),
    ])
    expect([first, second]).toEqual([true, false])
    const opened = auth.claim(claim, 2)
    if (opened.status !== 'confirmed') throw new Error(opened.status)
    const owner = await signedIn(auth, 'tg-first', 3)
    expect(auth.read(opened.token, 4)?.userId).toBe(auth.read(owner, 4)?.userId)
  })

  it('stays open for another confirm when the account is refused', async () => {
    const auth = service({ refuse: ['tg-deleted'] })
    const { handoffId, claim } = started(auth, 0)
    expect(await auth.confirm(handoffId, { id: 'tg-deleted' }, 1)).toBe(false)
    expect(auth.claim(claim, 2).status).toBe('waiting')
    expect(await auth.confirm(handoffId, { id: 'tg-ok' }, 3)).toBe(true)
  })

  it('stays open for a retry when the user store fails', async () => {
    const auth = service({ fail: 1 })
    const { handoffId, claim } = started(auth, 0)
    await expect(auth.confirm(handoffId, { id: 'tg-1' }, 1)).rejects.toThrow(
      'database down',
    )
    expect(auth.claim(claim, 2).status).toBe('waiting')
    expect(await auth.confirm(handoffId, { id: 'tg-1' }, 3)).toBe(true)
  })
})

describe('AuthService session', () => {
  it('carries the allow-listed role and profile name', async () => {
    const auth = service()
    const { handoffId, claim } = started(auth, 0)
    await auth.confirm(handoffId, { id: '500', name: 'Mukhtasar' }, 1)
    const opened = auth.claim(claim, 2)
    if (opened.status !== 'confirmed') throw new Error(opened.status)
    expect(auth.read(opened.token, 3)).toMatchObject({
      role: 'teacher',
      name: 'Mukhtasar',
    })
    const admin = await signedIn(auth, '900', 4)
    expect(auth.read(admin, 5)?.role).toBe('admin')
    const learner = await signedIn(auth, '12', 6)
    expect(auth.read(learner, 7)?.role).toBe('learner')
  })

  it('slides the 30 day window on use and ends it after silence', async () => {
    const auth = service()
    const token = await signedIn(auth, '12', 0)
    const nearEnd = SESSION_TTL_MS - 1000
    expect(auth.read(token, nearEnd)).not.toBeNull()
    expect(auth.read(token, nearEnd + SESSION_TTL_MS - 1000)).not.toBeNull()
    expect(auth.read(token, nearEnd + 2 * SESSION_TTL_MS)).toBeNull()
  })

  it('ends the session on logout and never reads an unknown token', async () => {
    const auth = service()
    const token = await signedIn(auth, '12', 0)
    auth.logout(token)
    expect(auth.read(token, 1)).toBeNull()
    expect(auth.read('made-up', 1)).toBeNull()
    expect(auth.read(undefined, 1)).toBeNull()
  })
})

describe('AuthService.preview', () => {
  it('shows the device and time of a live, unconfirmed handoff', () => {
    const auth = service()
    const { handoffId } = auth.start({
      ip: '203.0.113.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36',
      now: 1000,
    })
    expect(auth.preview(handoffId, 2000)).toEqual({
      device: 'Chrome, Windows',
      at: 1000,
    })
  })

  it('shows nothing once expired, confirmed or unknown', async () => {
    const auth = service()
    const { handoffId } = started(auth, 0)
    expect(auth.preview(handoffId, HANDOFF_TTL_MS + 1)).toBeNull()
    const confirmed = started(auth, 0)
    await auth.confirm(confirmed.handoffId, { id: 'tg-1' }, 1)
    expect(auth.preview(confirmed.handoffId, 2)).toBeNull()
    expect(auth.preview('nope', 2)).toBeNull()
  })
})

describe('AuthService memory', () => {
  it('forgets expired handoffs and idle rate buckets', () => {
    const auth = service()
    for (let i = 0; i < 4; i++) {
      auth.start({ ip: `203.0.113.${i}`, now: i })
    }
    expect(sizes(auth)).toEqual({ handoffs: 4, ipHits: 4 })
    auth.start({
      ip: '198.51.100.9',
      now: HANDOFF_TTL_MS + RATE_WINDOW_MS + 10,
    })
    expect(sizes(auth)).toEqual({ handoffs: 1, ipHits: 1 })
  })
})

describe('AuthService rate limit', () => {
  it('refuses the sixth start from one address inside a minute', () => {
    const auth = service()
    for (let i = 0; i < 5; i++) started(auth, i)
    expect(() => started(auth, 6)).toThrowError(
      expect.objectContaining({ status: 429 }),
    )
    expect(() => auth.start({ ip: '203.0.113.2', now: 6 })).not.toThrow()
    expect(() => started(auth, RATE_WINDOW_MS + 10)).not.toThrow()
  })
})
