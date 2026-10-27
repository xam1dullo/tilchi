import { createHmac } from 'node:crypto'

export const MEET_TOKEN_TTL_SECONDS = 120
export const LIVEKIT_DEV_KEY = 'devkey'
export const LIVEKIT_DEV_SECRET = 'devsecret-local-only-not-for-the-vps'
const MIN_SECRET_LENGTH = 32
const ROOM = /^[A-Za-z0-9_-]{1,64}$/

export type LiveKitCredentials = { apiKey: string; apiSecret: string }

export function livekitCredentials(
  env: Record<string, string | undefined>,
): LiveKitCredentials | null {
  const apiKey = env.LIVEKIT_API_KEY?.trim()
  const apiSecret = env.LIVEKIT_API_SECRET?.trim()
  if (!apiKey || !apiSecret || apiSecret.length < MIN_SECRET_LENGTH) return null
  const devPair = apiKey === LIVEKIT_DEV_KEY || apiSecret === LIVEKIT_DEV_SECRET
  if (env.NODE_ENV === 'production' && devPair) return null
  return { apiKey, apiSecret }
}

export function parseRoom(body: unknown) {
  if (!body || typeof body !== 'object') return undefined
  const room = (body as { room?: unknown }).room
  return typeof room === 'string' && ROOM.test(room) ? room : undefined
}

function part(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

// LiveKit access token: HS256 JWT signed with the API secret, which never leaves the server.
export function mintLiveKitToken(input: {
  credentials: LiveKitCredentials
  identity: string
  room: string
  now?: number
}) {
  const now = Math.floor((input.now ?? Date.now()) / 1000)
  const unsigned = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({
    iss: input.credentials.apiKey,
    sub: input.identity,
    nbf: now,
    exp: now + MEET_TOKEN_TTL_SECONDS,
    video: {
      room: input.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    },
  })}`
  const signature = createHmac('sha256', input.credentials.apiSecret)
    .update(unsigned)
    .digest('base64url')
  return `${unsigned}.${signature}`
}
