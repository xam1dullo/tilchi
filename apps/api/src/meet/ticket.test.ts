import { describe, expect, it } from 'vitest'
import { MEET_TICKET_TTL_SECONDS, issueMeetTicket } from './ticket'

describe('issueMeetTicket', () => {
  it('returns a short-lived ticket that does not carry the session', () => {
    const sessionToken = 'session-secret-value'
    const issued = issueMeetTicket({ sessionToken })
    expect(issued.expiresInSeconds).toBe(MEET_TICKET_TTL_SECONDS)
    expect(issued.expiresInSeconds).toBeLessThanOrEqual(120)
    expect(JSON.stringify(issued)).not.toContain(sessionToken)
    expect(issued.ticket).not.toBe(sessionToken)
  })
})
