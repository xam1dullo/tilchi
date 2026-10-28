import { describe, expect, it } from 'vitest'
import { MEET_TICKET_TTL_SECONDS, issueMeetTicket } from './ticket'

describe('issueMeetTicket', () => {
  it('returns a marked stub that does not carry the session', () => {
    const sessionToken = 'session-secret-value'
    const issued = issueMeetTicket({ sessionToken })
    expect(issued.stub).toBe(true)
    expect(issued.expiresInSeconds).toBe(MEET_TICKET_TTL_SECONDS)
    expect(JSON.stringify(issued)).not.toContain(sessionToken)
    expect(issued.ticket).not.toBe(sessionToken)
  })
})
