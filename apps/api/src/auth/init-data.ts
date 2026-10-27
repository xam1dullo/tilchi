import { createHmac, timingSafeEqual } from 'node:crypto'
export type InitDataUser = { telegramUserId: string; name: string }

export const INIT_DATA_MAX_AGE_SECONDS = 60 * 60
const FUTURE_SKEW_SECONDS = 60

/** Mini App initData: HMAC-SHA256 keyed by the bot token, plus a freshness check. */
export function verifyInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): InitDataUser | null {
  if (!botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(check).digest()
  const given = Buffer.from(hash, 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null
  }
  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || authDate <= 0) return null
  if (nowSeconds - authDate > INIT_DATA_MAX_AGE_SECONDS) return null
  if (authDate - nowSeconds > FUTURE_SKEW_SECONDS) return null
  return userFrom(params.get('user'))
}

function userFrom(raw: string | null): InitDataUser | null {
  try {
    const user = JSON.parse(raw ?? '') as {
      id?: unknown
      first_name?: unknown
      last_name?: unknown
    }
    if (typeof user.id !== 'number' || !Number.isSafeInteger(user.id))
      return null
    const parts = [user.first_name, user.last_name].filter(
      (part): part is string => typeof part === 'string' && part !== '',
    )
    return {
      telegramUserId: String(user.id),
      name: parts.join(' ') || String(user.id),
    }
  } catch {
    return null
  }
}
