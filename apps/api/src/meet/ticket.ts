import { randomBytes } from 'node:crypto'

export const MEET_TICKET_TTL_SECONDS = 60

export function issueMeetTicket(input: { sessionToken: string }) {
  if (!input.sessionToken) throw new Error('session required')
  const ticket = randomBytes(24).toString('base64url')
  return { ticket, expiresInSeconds: MEET_TICKET_TTL_SECONDS }
}
