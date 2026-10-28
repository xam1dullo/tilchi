import { AccessToken } from 'livekit-server-sdk'

export type LivekitClaims = {
  room: string
  identity: string
  name: string
  canPublish: boolean
}

export async function mintLivekitToken(input: {
  apiKey: string
  apiSecret: string
  claims: LivekitClaims
  ttlSeconds?: number
}) {
  if (!input.apiKey || !input.apiSecret) {
    throw new Error('livekit credentials missing')
  }
  const token = new AccessToken(input.apiKey, input.apiSecret, {
    identity: input.claims.identity,
    name: input.claims.name,
    ttl: input.ttlSeconds ?? 60,
  })
  token.addGrant({
    roomJoin: true,
    room: input.claims.room,
    canPublish: input.claims.canPublish,
    canSubscribe: true,
  })
  const jwt = await token.toJwt()
  return {
    token: jwt,
    expiresInSeconds: input.ttlSeconds ?? 60,
    room: input.claims.room,
  }
}
