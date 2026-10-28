import { randomBytes } from 'node:crypto'

export const MEET_TICKET_TTL_SECONDS = 60

/** Stub only. Not stored, not scoped to a room, not single-use. Do not mint LiveKit from this. */
export function issueMeetTicket(input: { sessionToken: string }) {
  if (!input.sessionToken) throw new Error('session required')
  const ticket = randomBytes(24).toString('base64url')
  return {
    stub: true as const,
    ticket,
    expiresInSeconds: MEET_TICKET_TTL_SECONDS,
    note: 'meet ticket is a stub until it is signed, room-scoped, single-use, and Redis-backed',
  }
}
