export type ClaimOutcome = 'waiting' | 'expired' | 'confirmed' | 'failed'
export type PollResult = Exclude<ClaimOutcome, 'waiting'> | 'cancelled'

export const POLL_INTERVAL_MS = 2000
// A phone that backgrounds the tab drops a few requests; a longer run of them means the network is gone.
export const MAX_POLL_FAILURES = 5

export function claimOutcome(status: number): ClaimOutcome {
  if (status === 202) return 'waiting'
  if (status === 410) return 'expired'
  if (status === 201) return 'confirmed'
  return 'failed'
}

// The API builds the link, but the browser only ever opens Telegram.
export function isTelegramLink(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 't.me'
  } catch {
    return false
  }
}

export type SignInState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'waiting'; deepLink: string }
  | { phase: 'expired' }
  | { phase: 'confirmed' }
  | { phase: 'failed' }

export type SignInEvent =
  | { type: 'start' }
  | { type: 'started'; deepLink: string | null }
  | { type: 'claimed'; outcome: Exclude<ClaimOutcome, 'waiting'> }

// Starting a sign-in costs rate-limit budget, so a second click while one is
// running (or after it succeeded) changes nothing.
export function canStart(state: SignInState): boolean {
  return (
    state.phase === 'idle' ||
    state.phase === 'expired' ||
    state.phase === 'failed'
  )
}

export function reduce(state: SignInState, event: SignInEvent): SignInState {
  switch (event.type) {
    case 'start':
      return canStart(state) ? { phase: 'starting' } : state
    case 'started':
      if (state.phase !== 'starting') return state
      return event.deepLink
        ? { phase: 'waiting', deepLink: event.deepLink }
        : { phase: 'failed' }
    case 'claimed':
      return state.phase === 'waiting' ? { phase: event.outcome } : state
  }
}

export async function pollClaim(options: {
  claim: () => Promise<ClaimOutcome>
  sleep: (ms: number) => Promise<void>
  cancelled: () => boolean
}): Promise<PollResult> {
  let failures = 0
  while (!options.cancelled()) {
    const outcome = await options.claim()
    if (options.cancelled()) break
    if (outcome === 'confirmed' || outcome === 'expired') return outcome
    failures = outcome === 'failed' ? failures + 1 : 0
    if (failures >= MAX_POLL_FAILURES) return 'failed'
    await options.sleep(POLL_INTERVAL_MS)
  }
  return 'cancelled'
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function startHandoff(): Promise<string | null> {
  try {
    const response = await fetch('/auth/start', {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) return null
    const body = (await response.json()) as { deepLink?: unknown }
    return typeof body.deepLink === 'string' && isTelegramLink(body.deepLink)
      ? body.deepLink
      : null
  } catch {
    return null
  }
}

export async function claimOnce(): Promise<ClaimOutcome> {
  try {
    const response = await fetch('/auth/claim', {
      method: 'POST',
      credentials: 'include',
    })
    return claimOutcome(response.status)
  } catch {
    return 'failed'
  }
}
