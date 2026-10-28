import { describe, expect, it } from 'vitest'
import type { AuthResult } from './api'
import {
  MAX_POLL_STRIKES,
  failureReason,
  initialLogin,
  loginReducer,
  parseStart,
  pollEvent,
  type FailureReason,
  type LoginEvent,
  type LoginState,
} from './login-flow'

const LINK = 'https://t.me/tilchiuz_bot?start=abc'
const waiting = (strikes = 0): LoginState => ({
  kind: 'waiting',
  deepLink: LINK,
  strikes,
})
const failed = (reason: FailureReason): LoginState => ({
  kind: 'failed',
  reason,
})
const run = (state: LoginState, ...events: LoginEvent[]) =>
  events.reduce(loginReducer, state)

describe('loginReducer: deep link flow', () => {
  it('walks idle -> starting -> waiting -> confirmed', () => {
    expect(initialLogin).toEqual({ kind: 'idle' })
    expect(run(initialLogin, { type: 'begin' })).toEqual({ kind: 'starting' })
    expect(
      run(initialLogin, { type: 'begin' }, { type: 'started', deepLink: LINK }),
    ).toEqual(waiting())
    expect(run(waiting(2), { type: 'confirmed' })).toEqual({
      kind: 'confirmed',
    })
  })

  it('lets begin start from idle and retry from failed only', () => {
    expect(run(failed('expired'), { type: 'begin' })).toEqual({
      kind: 'starting',
    })
    for (const busy of [
      { kind: 'starting' },
      { kind: 'verifying' },
      waiting(),
      { kind: 'confirmed' },
    ] as const) {
      expect(loginReducer(busy, { type: 'begin' })).toBe(busy)
    }
  })

  it('keeps waiting on a 409 and forgets earlier strikes', () => {
    expect(loginReducer(waiting(2), { type: 'pending' })).toEqual(waiting(0))
  })

  it('counts consecutive strikes and fails with the last reason at the limit', () => {
    let state = waiting()
    for (let strike = 1; strike < MAX_POLL_STRIKES; strike += 1) {
      state = loginReducer(state, { type: 'strike', reason: 'network' })
      expect(state).toEqual(waiting(strike))
    }
    expect(
      loginReducer(state, { type: 'strike', reason: 'unavailable' }),
    ).toEqual(failed('unavailable'))
  })

  it('does not let a good poll between strikes add up to a failure', () => {
    const state = run(
      waiting(),
      { type: 'strike', reason: 'network' },
      { type: 'strike', reason: 'network' },
      { type: 'pending' },
      { type: 'strike', reason: 'network' },
    )
    expect(state).toEqual(waiting(1))
  })

  it('fails a waiting login on a terminal error or the deadline', () => {
    expect(
      loginReducer(waiting(), { type: 'failed', reason: 'rejected' }),
    ).toEqual(failed('rejected'))
    expect(loginReducer(waiting(1), { type: 'deadline' })).toEqual(
      failed('expired'),
    )
  })

  it('fails a login whose start request was refused', () => {
    expect(
      run(
        initialLogin,
        { type: 'begin' },
        { type: 'failed', reason: 'rate_limited' },
      ),
    ).toEqual(failed('rate_limited'))
  })
})

describe('loginReducer: Mini App flow', () => {
  it('verifies from idle and ends confirmed or failed', () => {
    expect(run(initialLogin, { type: 'verify' })).toEqual({
      kind: 'verifying',
    })
    expect(
      run(initialLogin, { type: 'verify' }, { type: 'confirmed' }),
    ).toEqual({ kind: 'confirmed' })
    expect(
      run(
        initialLogin,
        { type: 'verify' },
        { type: 'failed', reason: 'rejected' },
      ),
    ).toEqual(failed('rejected'))
  })

  it('verifies only from idle', () => {
    for (const state of [
      { kind: 'starting' },
      waiting(),
      { kind: 'confirmed' },
      failed('network'),
    ] as const) {
      expect(loginReducer(state, { type: 'verify' })).toBe(state)
    }
  })
})

describe('loginReducer: events that do not apply', () => {
  const pollEvents: LoginEvent[] = [
    { type: 'pending' },
    { type: 'strike', reason: 'network' },
    { type: 'deadline' },
  ]

  it('never revives a failed login', () => {
    const state = failed('expired')
    const events: LoginEvent[] = [
      { type: 'started', deepLink: LINK },
      { type: 'confirmed' },
      { type: 'failed', reason: 'network' },
      ...pollEvents,
    ]
    for (const event of events) expect(loginReducer(state, event)).toBe(state)
  })

  it('ignores poll and deadline events outside waiting', () => {
    for (const state of [
      initialLogin,
      { kind: 'starting' },
      { kind: 'verifying' },
      { kind: 'confirmed' },
    ] as const) {
      for (const event of pollEvents) {
        expect(loginReducer(state, event)).toBe(state)
      }
    }
  })

  it('accepts a start result only while starting', () => {
    for (const state of [
      initialLogin,
      { kind: 'verifying' },
      waiting(),
      { kind: 'confirmed' },
      failed('network'),
    ] as const) {
      expect(loginReducer(state, { type: 'started', deepLink: LINK })).toBe(
        state,
      )
    }
  })

  it('accepts a confirmation only from waiting or verifying', () => {
    for (const state of [
      initialLogin,
      { kind: 'starting' },
      { kind: 'confirmed' },
    ] as const) {
      expect(loginReducer(state, { type: 'confirmed' })).toBe(state)
    }
  })

  it('lets a confirmed login fail when no session appears', () => {
    expect(
      loginReducer(
        { kind: 'confirmed' },
        { type: 'failed', reason: 'unavailable' },
      ),
    ).toEqual(failed('unavailable'))
  })

  it('ignores a failure when nothing is in flight', () => {
    expect(
      loginReducer(initialLogin, { type: 'failed', reason: 'network' }),
    ).toBe(initialLogin)
  })

  it('keeps the same object for a 409 when there is nothing to forget', () => {
    const state = waiting(0)
    expect(loginReducer(state, { type: 'pending' })).toBe(state)
  })
})

describe('failureReason', () => {
  it('maps API statuses to one user-facing reason', () => {
    expect(failureReason(410)).toBe('expired')
    expect(failureReason(403)).toBe('rejected')
    expect(failureReason(401)).toBe('rejected')
    expect(failureReason(429)).toBe('rate_limited')
    expect(failureReason(null)).toBe('network')
    expect(failureReason(500)).toBe('unavailable')
    expect(failureReason(503)).toBe('unavailable')
    expect(failureReason(404)).toBe('unavailable')
  })
})

describe('pollEvent', () => {
  const fail = (status: number | null): AuthResult => ({ ok: false, status })

  it('turns a 2xx into a confirmation', () => {
    expect(pollEvent({ ok: true, body: { ok: true } })).toEqual({
      type: 'confirmed',
    })
  })

  it('treats 409 as still waiting', () => {
    expect(pollEvent(fail(409))).toEqual({ type: 'pending' })
  })

  it('treats a missing answer and 5xx as strikes, not as the end', () => {
    expect(pollEvent(fail(null))).toEqual({ type: 'strike', reason: 'network' })
    expect(pollEvent(fail(500))).toEqual({
      type: 'strike',
      reason: 'unavailable',
    })
    expect(pollEvent(fail(503))).toEqual({
      type: 'strike',
      reason: 'unavailable',
    })
  })

  it('treats the other answers as the end', () => {
    expect(pollEvent(fail(410))).toEqual({ type: 'failed', reason: 'expired' })
    expect(pollEvent(fail(403))).toEqual({ type: 'failed', reason: 'rejected' })
    expect(pollEvent(fail(429))).toEqual({
      type: 'failed',
      reason: 'rate_limited',
    })
    expect(pollEvent(fail(400))).toEqual({
      type: 'failed',
      reason: 'unavailable',
    })
    expect(pollEvent(fail(499))).toEqual({
      type: 'failed',
      reason: 'unavailable',
    })
  })
})

describe('parseStart', () => {
  const good = { handoffId: 'h-1', deepLink: LINK, expiresInSeconds: 300 }

  it('reads the handoff id and the Telegram link', () => {
    expect(parseStart({ ok: true, body: good })).toEqual({
      ok: true,
      handoffId: 'h-1',
      deepLink: LINK,
    })
  })

  it('reports the reason when the request failed', () => {
    expect(parseStart({ ok: false, status: 429 })).toEqual({
      ok: false,
      reason: 'rate_limited',
    })
    expect(parseStart({ ok: false, status: null })).toEqual({
      ok: false,
      reason: 'network',
    })
  })

  it('refuses a body the API contract does not allow', () => {
    const bad: unknown[] = [
      null,
      'text',
      42,
      {},
      { handoffId: 'h-1' },
      { deepLink: LINK },
      { ...good, handoffId: '' },
      { ...good, handoffId: 7 },
      { ...good, deepLink: 7 },
      { ...good, deepLink: 'javascript:alert(1)' },
      { ...good, deepLink: 'http://t.me/tilchiuz_bot' },
      { ...good, deepLink: 'https://evil.example/https://t.me/x' },
      { ...good, deepLink: 'https://t.me.evil.example/x' },
    ]
    for (const body of bad) {
      expect(parseStart({ ok: true, body })).toEqual({
        ok: false,
        reason: 'unavailable',
      })
    }
  })
})
