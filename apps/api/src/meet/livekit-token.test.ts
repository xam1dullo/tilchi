import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  LIVEKIT_DEV_SECRET,
  MEET_TOKEN_TTL_SECONDS,
  livekitCredentials,
  mintLiveKitToken,
} from './livekit-token'

const secret = 'x'.repeat(32)
const credentials = { apiKey: 'key1', apiSecret: secret }

function decode(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

function mint(extra: { name?: string | null; roomAdmin?: boolean } = {}) {
  const token = mintLiveKitToken({
    credentials,
    identity: 'user-1',
    room: 'lesson-1',
    now: 1_000_000,
    ...extra,
  })
  const [header, payload, signature] = token.split('.')
  return { header, payload, signature, claims: decode(payload) }
}

describe('mintLiveKitToken', () => {
  it('signs a short-lived room grant for one identity', () => {
    const { header, payload, signature, claims } = mint()
    expect(decode(header)).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(
      createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url'),
    ).toBe(signature)
    expect(claims).toEqual({
      iss: 'key1',
      sub: 'user-1',
      nbf: 1000,
      exp: 1000 + MEET_TOKEN_TTL_SECONDS,
      video: {
        room: 'lesson-1',
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      },
    })
    expect(MEET_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(120)
  })

  it('shows the participant name when there is one', () => {
    expect(mint({ name: 'Aziza' }).claims.name).toBe('Aziza')
    expect(mint({ name: null }).claims).not.toHaveProperty('name')
    expect(mint({ name: '' }).claims).not.toHaveProperty('name')
  })

  it('grants room admin only when asked', () => {
    expect(mint({ roomAdmin: true }).claims.video.roomAdmin).toBe(true)
    expect(mint({ roomAdmin: false }).claims.video).not.toHaveProperty(
      'roomAdmin',
    )
    expect(mint().claims.video).not.toHaveProperty('roomAdmin')
  })

  it('never carries the signing secret', () => {
    const { payload } = mint({ roomAdmin: true, name: 'Aziza' })
    expect(Buffer.from(payload, 'base64url').toString()).not.toContain(secret)
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
