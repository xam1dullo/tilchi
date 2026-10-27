import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  LIVEKIT_DEV_SECRET,
  MEET_TOKEN_TTL_SECONDS,
  livekitCredentials,
  mintLiveKitToken,
  parseRoom,
} from './livekit-token'

const secret = 'x'.repeat(32)

function decode(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

describe('mintLiveKitToken', () => {
  it('signs a short-lived room grant for one identity', () => {
    const token = mintLiveKitToken({
      credentials: { apiKey: 'key1', apiSecret: secret },
      identity: 'user-1',
      room: 'lesson-1',
      now: 1_000_000,
    })
    const [header, payload, signature] = token.split('.')
    expect(decode(header)).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(
      createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url'),
    ).toBe(signature)
    const claims = decode(payload)
    expect(claims).toMatchObject({
      iss: 'key1',
      sub: 'user-1',
      nbf: 1000,
      exp: 1000 + MEET_TOKEN_TTL_SECONDS,
      video: { room: 'lesson-1', roomJoin: true },
    })
    expect(MEET_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(120)
  })
})

describe('livekitCredentials', () => {
  it('needs both the key and the secret', () => {
    expect(livekitCredentials({ LIVEKIT_API_KEY: 'k' })).toBeNull()
    expect(livekitCredentials({ LIVEKIT_API_SECRET: secret })).toBeNull()
  })

  it('accepts the dev pair outside production only', () => {
    const dev = {
      LIVEKIT_API_KEY: 'devkey',
      LIVEKIT_API_SECRET: LIVEKIT_DEV_SECRET,
    }
    expect(livekitCredentials(dev)).toEqual({
      apiKey: 'devkey',
      apiSecret: LIVEKIT_DEV_SECRET,
    })
    expect(livekitCredentials({ ...dev, NODE_ENV: 'production' })).toBeNull()
  })

  it('refuses a short secret', () => {
    expect(
      livekitCredentials({ LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 'short' }),
    ).toBeNull()
  })
})

describe('parseRoom', () => {
  it('keeps a plain room name and drops anything else', () => {
    expect(parseRoom({ room: 'lesson-01_a' })).toBe('lesson-01_a')
    expect(parseRoom({ room: '../admin' })).toBeUndefined()
    expect(parseRoom({ room: 'x'.repeat(65) })).toBeUndefined()
    expect(parseRoom({ room: 7 })).toBeUndefined()
    expect(parseRoom(null)).toBeUndefined()
  })
})
