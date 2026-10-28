import { ApiError, apiFetch } from './api'
import type { Failure } from './meet'
import type { AppRole } from './nav'

export type MeetToken = {
  token: string
  room: string
  expiresInSeconds: number
}

type GetToken = (
  path: string,
  init: { method: 'POST'; previewRole: AppRole | null },
) => Promise<MeetToken>

/** Asks Nest for a short-lived LiveKit token. The browser never holds API keys. */
export function fetchMeetToken(
  lessonId: string,
  previewRole: AppRole | null,
  get: GetToken = apiFetch<MeetToken>,
): Promise<MeetToken> {
  return get(`/api/meet/lessons/${encodeURIComponent(lessonId)}/token`, {
    method: 'POST',
    previewRole,
  })
}

/** What the user is told when the token request fails. */
export function tokenFailure(error: unknown): Failure {
  if (!(error instanceof ApiError)) return 'unavailable'
  switch (error.status) {
    case 401:
    case 403:
    case 404:
      return 'forbidden'
    case 409:
      return 'notLive'
    case 501:
      return 'unconfigured'
    default:
      return 'unavailable'
  }
}

/**
 * LiveKit signaling goes through nginx at /rtc. The SDK appends its own /rtc
 * to this URL, which nginx strips back to one (docs/adr/0009-livekit.md).
 */
export function signalUrl(location: { protocol: string; host: string }) {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}/rtc`
}
