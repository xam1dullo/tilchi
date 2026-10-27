import { describe, expect, it } from 'vitest'
import { mintLivekitToken } from './livekit'

describe('mintLivekitToken', () => {
  it('returns a jwt that does not embed a session cookie value', async () => {
    const sessionToken = 'session-secret-value'
    const issued = await mintLivekitToken({
      apiKey: 'devkey',
      apiSecret: 'devsecret',
      claims: {
        room: 'lesson-1',
        identity: 'user-1',
        name: 'Ada',
        canPublish: true,
      },
    })
    expect(issued.expiresInSeconds).toBe(60)
    expect(issued.token.split('.')).toHaveLength(3)
    expect(issued.token).not.toContain(sessionToken)
    expect(JSON.stringify(issued)).not.toContain(sessionToken)
  })
})
