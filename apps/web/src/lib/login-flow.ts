import type { AuthResult } from './api'

export const POLL_INTERVAL_MS = 2_000
/** The handoff lives 5 minutes on the server (ADR 0002). */
export const MAX_WAIT_MS = 5 * 60 * 1_000
/** Polls in a row that may get no answer before the login is called failed. */
export const MAX_POLL_STRIKES = 3
const TELEGRAM_LINK = 'https://t.me/'

export type FailureReason =
  | 'expired'
  | 'rejected'
  | 'rate_limited'
  | 'network'
  | 'unavailable'

export type LoginState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'verifying' }
  | { kind: 'waiting'; deepLink: string; strikes: number }
  | { kind: 'confirmed' }
  | { kind: 'failed'; reason: FailureReason }

export type LoginEvent =
  | { type: 'begin' }
  | { type: 'verify' }
  | { type: 'started'; deepLink: string }
  | { type: 'pending' }
  | { type: 'strike'; reason: FailureReason }
  | { type: 'confirmed' }
  | { type: 'failed'; reason: FailureReason }
  | { type: 'deadline' }

type Waiting = Extract<LoginState, { kind: 'waiting' }>

export const initialLogin: LoginState = { kind: 'idle' }

const fail = (reason: FailureReason): LoginState => ({ kind: 'failed', reason })

function fromIdle(state: LoginState, event: LoginEvent): LoginState {
  if (event.type === 'begin') return { kind: 'starting' }
  if (event.type === 'verify') return { kind: 'verifying' }
  return state
}

function fromStarting(state: LoginState, event: LoginEvent): LoginState {
  if (event.type === 'started') {
    return { kind: 'waiting', deepLink: event.deepLink, strikes: 0 }
  }
  return event.type === 'failed' ? fail(event.reason) : state
}

function fromVerifying(state: LoginState, event: LoginEvent): LoginState {
  if (event.type === 'confirmed') return { kind: 'confirmed' }
  return event.type === 'failed' ? fail(event.reason) : state
}

function fromWaiting(state: Waiting, event: LoginEvent): LoginState {
  switch (event.type) {
    case 'pending':
      return state.strikes === 0 ? state : { ...state, strikes: 0 }
    case 'strike':
      return state.strikes + 1 >= MAX_POLL_STRIKES
        ? fail(event.reason)
        : { ...state, strikes: state.strikes + 1 }
    case 'confirmed':
      return { kind: 'confirmed' }
    case 'failed':
      return fail(event.reason)
    case 'deadline':
      return fail('expired')
    default:
      return state
  }
}

/** The session cookie can be missing after a confirmation, so it may still fail. */
function fromConfirmed(state: LoginState, event: LoginEvent): LoginState {
  return event.type === 'failed' ? fail(event.reason) : state
}

function fromFailed(state: LoginState, event: LoginEvent): LoginState {
  return event.type === 'begin' ? { kind: 'starting' } : state
}

/** Pure. An event that does not apply returns the same state object. */
export function loginReducer(state: LoginState, event: LoginEvent): LoginState {
  switch (state.kind) {
    case 'idle':
      return fromIdle(state, event)
    case 'starting':
      return fromStarting(state, event)
    case 'verifying':
      return fromVerifying(state, event)
    case 'waiting':
      return fromWaiting(state, event)
    case 'confirmed':
      return fromConfirmed(state, event)
    case 'failed':
      return fromFailed(state, event)
  }
}

const reasonByStatus: Partial<Record<number, FailureReason>> = {
  401: 'rejected',
  403: 'rejected',
  410: 'expired',
  429: 'rate_limited',
}

/** One reading of an API status for every auth call. null: no answer at all. */
export function failureReason(status: number | null): FailureReason {
  if (status === null) return 'network'
  return reasonByStatus[status] ?? 'unavailable'
}

/** 409 is the API saying "the bot has not confirmed yet". */
export function pollEvent(result: AuthResult): LoginEvent {
  if (result.ok) return { type: 'confirmed' }
  const { status } = result
  if (status === 409) return { type: 'pending' }
  const reason = failureReason(status)
  return status === null || status >= 500
    ? { type: 'strike', reason }
    : { type: 'failed', reason }
}

export type StartRead =
  | { ok: true; handoffId: string; deepLink: string }
  | { ok: false; reason: FailureReason }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function text(body: unknown, key: string) {
  const value = isRecord(body) ? body[key] : undefined
  return typeof value === 'string' ? value : ''
}

/** Boundary check for POST /auth/start: only a Telegram link may be opened. */
export function parseStart(result: AuthResult): StartRead {
  if (!result.ok) return { ok: false, reason: failureReason(result.status) }
  const handoffId = text(result.body, 'handoffId')
  const deepLink = text(result.body, 'deepLink')
  return handoffId !== '' && deepLink.startsWith(TELEGRAM_LINK)
    ? { ok: true, handoffId, deepLink }
    : { ok: false, reason: 'unavailable' }
}
