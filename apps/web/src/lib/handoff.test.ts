import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_POLL_FAILURES,
  POLL_INTERVAL_MS,
  type ClaimOutcome,
  canStart,
  claimOnce,
  claimOutcome,
  isTelegramLink,
  pollClaim,
  reduce,
  startHandoff,
} from './handoff'

describe('claimOutcome', () => {
  it.each([
    [202, 'waiting'],
    [410, 'expired'],
    [201, 'confirmed'],
    [200, 'failed'],
    [401, 'failed'],
    [404, 'failed'],
    [429, 'failed'],
    [500, 'failed'],
  ] as const)('maps HTTP %i to %s', (status, outcome) => {
    expect(claimOutcome(status)).toBe(outcome)
  })
})

describe('isTelegramLink', () => {
  it('accepts only https links on t.me', () => {
    expect(isTelegramLink('https://t.me/tilchiuz_bot?start=login_abc')).toBe(
      true,
    )
    expect(isTelegramLink('http://t.me/tilchiuz_bot')).toBe(false)
    expect(isTelegramLink('https://t.me.evil.example/x')).toBe(false)
    expect(isTelegramLink('https://evilt.me/login')).toBe(false)
    expect(isTelegramLink('https://evil.example/t.me')).toBe(false)
    expect(isTelegramLink('https://user@t.me@evil.example/')).toBe(false)
    expect(isTelegramLink('javascript:alert(1)')).toBe(false)
    expect(isTelegramLink('tg://resolve?domain=tilchiuz_bot')).toBe(false)
    expect(isTelegramLink('not a url')).toBe(false)
    expect(isTelegramLink('')).toBe(false)
  })
})

describe('canStart', () => {
  const link = 'https://t.me/tilchiuz_bot?start=login_abc'

  it('allows a new sign-in only before one began or after one ended badly', () => {
    expect(canStart({ phase: 'idle' })).toBe(true)
    expect(canStart({ phase: 'expired' })).toBe(true)
    expect(canStart({ phase: 'failed' })).toBe(true)
    expect(canStart({ phase: 'starting' })).toBe(false)
    expect(canStart({ phase: 'waiting', deepLink: link })).toBe(false)
    expect(canStart({ phase: 'confirmed' })).toBe(false)
  })
})

describe('reduce', () => {
  const link = 'https://t.me/tilchiuz_bot?start=login_abc'

  it('walks idle to starting to waiting to confirmed', () => {
    let state = reduce({ phase: 'idle' }, { type: 'start' })
    expect(state).toEqual({ phase: 'starting' })
    state = reduce(state, { type: 'started', deepLink: link })
    expect(state).toEqual({ phase: 'waiting', deepLink: link })
    state = reduce(state, { type: 'claimed', outcome: 'confirmed' })
    expect(state).toEqual({ phase: 'confirmed' })
  })

  it('fails when the start gave no usable link', () => {
    const state = reduce(
      { phase: 'starting' },
      { type: 'started', deepLink: null },
    )
    expect(state).toEqual({ phase: 'failed' })
  })

  it('lets expired and failed attempts start again', () => {
    expect(reduce({ phase: 'expired' }, { type: 'start' })).toEqual({
      phase: 'starting',
    })
    expect(reduce({ phase: 'failed' }, { type: 'start' })).toEqual({
      phase: 'starting',
    })
  })

  it('ignores a second start while one is running or confirmed', () => {
    const waiting = { phase: 'waiting', deepLink: link } as const
    for (const state of [
      { phase: 'starting' },
      waiting,
      { phase: 'confirmed' },
    ] as const) {
      expect(reduce(state, { type: 'start' })).toBe(state)
    }
  })

  it('ignores results that arrive in the wrong phase', () => {
    const idle = { phase: 'idle' } as const
    const expired = { phase: 'expired' } as const
    expect(reduce(idle, { type: 'started', deepLink: link })).toBe(idle)
    expect(reduce(idle, { type: 'claimed', outcome: 'confirmed' })).toBe(idle)
    expect(reduce(expired, { type: 'claimed', outcome: 'confirmed' })).toBe(
      expired,
    )
  })

  it.each(['expired', 'failed'] as const)(
    'ends the wait with %s',
    (outcome) => {
      const state = reduce(
        { phase: 'waiting', deepLink: link },
        { type: 'claimed', outcome },
      )
      expect(state).toEqual({ phase: outcome })
    },
  )
})

describe('pollClaim', () => {
  function script(outcomes: ClaimOutcome[]) {
    const queue = [...outcomes]
    const claim = vi.fn(async () => queue.shift() ?? 'waiting')
    const sleep = vi.fn(async () => {})
    return { claim, sleep }
  }

  it('keeps asking every interval until the bot confirms', async () => {
    const { claim, sleep } = script(['waiting', 'waiting', 'confirmed'])
    const result = await pollClaim({ claim, sleep, cancelled: () => false })
    expect(result).toBe('confirmed')
    expect(claim).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(POLL_INTERVAL_MS)
  })

  it('stops at once when the handoff expired', async () => {
    const { claim, sleep } = script(['waiting', 'expired'])
    const result = await pollClaim({ claim, sleep, cancelled: () => false })
    expect(result).toBe('expired')
    expect(claim).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('survives isolated failures but not a run of them', async () => {
    const flaky = script(['failed', 'waiting', 'failed', 'confirmed'])
    expect(await pollClaim({ ...flaky, cancelled: () => false })).toBe(
      'confirmed',
    )

    const scattered = script([
      ...Array.from(
        { length: MAX_POLL_FAILURES },
        () => ['failed', 'waiting'] as ClaimOutcome[],
      ).flat(),
      'confirmed',
    ])
    expect(await pollClaim({ ...scattered, cancelled: () => false })).toBe(
      'confirmed',
    )

    const down = script(Array(MAX_POLL_FAILURES + 3).fill('failed'))
    expect(await pollClaim({ ...down, cancelled: () => false })).toBe('failed')
    expect(down.claim).toHaveBeenCalledTimes(MAX_POLL_FAILURES)
  })

  it('does not ask again once the caller cancelled', async () => {
    const gone = script(['waiting'])
    expect(await pollClaim({ ...gone, cancelled: () => true })).toBe(
      'cancelled',
    )
    expect(gone.claim).not.toHaveBeenCalled()

    let stop = false
    const mid = script(['confirmed'])
    const claim = vi.fn(async () => {
      stop = true
      return mid.claim()
    })
    const result = await pollClaim({
      claim,
      sleep: mid.sleep,
      cancelled: () => stop,
    })
    expect(result).toBe('cancelled')
    expect(claim).toHaveBeenCalledTimes(1)
    expect(mid.sleep).not.toHaveBeenCalled()
  })
})

describe('network calls', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubFetch(response: Response | Error) {
    const fetchMock = vi.fn(async () => {
      if (response instanceof Error) throw response
      return response
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('starts a handoff with the cookie jar and returns the Telegram link', async () => {
    const link = 'https://t.me/tilchiuz_bot?start=login_abc'
    const fetchMock = stubFetch(
      Response.json({
        handoffId: 'abc',
        deepLink: link,
        expiresInSeconds: 300,
      }),
    )
    expect(await startHandoff()).toBe(link)
    expect(fetchMock).toHaveBeenCalledWith('/auth/start', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('refuses a start link that does not point at Telegram', async () => {
    stubFetch(Response.json({ deepLink: 'https://evil.example/login' }))
    expect(await startHandoff()).toBeNull()
    stubFetch(Response.json({ deepLink: 42 }))
    expect(await startHandoff()).toBeNull()
    stubFetch(
      Response.json(
        { deepLink: 'https://t.me/tilchiuz_bot?start=login_abc' },
        { status: 500 },
      ),
    )
    expect(await startHandoff()).toBeNull()
    stubFetch(Response.json({}))
    expect(await startHandoff()).toBeNull()
  })

  it('gives no link when the start was refused or the network is down', async () => {
    stubFetch(Response.json({ error: 'rate_limited' }, { status: 429 }))
    expect(await startHandoff()).toBeNull()
    stubFetch(new TypeError('Failed to fetch'))
    expect(await startHandoff()).toBeNull()
    stubFetch(new Response('<html>', { status: 200 }))
    expect(await startHandoff()).toBeNull()
  })

  it('claims with the cookie jar and maps the status', async () => {
    const fetchMock = stubFetch(
      Response.json({ status: 'waiting' }, { status: 202 }),
    )
    expect(await claimOnce()).toBe('waiting')
    expect(fetchMock).toHaveBeenCalledWith('/auth/claim', {
      method: 'POST',
      credentials: 'include',
    })
    stubFetch(Response.json({ status: 'confirmed' }, { status: 201 }))
    expect(await claimOnce()).toBe('confirmed')
    stubFetch(Response.json({ error: 'handoff_expired' }, { status: 410 }))
    expect(await claimOnce()).toBe('expired')
  })

  it('reports a failed claim when the network drops', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    expect(await claimOnce()).toBe('failed')
  })
})
