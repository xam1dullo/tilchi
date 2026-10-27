// Production bot; staging sets TELEGRAM_BOT_USERNAME.
const DEFAULT_BOT_USERNAME = 'tilchiuz_bot'
// Telegram handles: 5-32 characters, letters, digits and underscore, starting with a letter.
const BOT_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/

const LOGIN_PREFIX = 'login_'
const HANDOFF_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

type Env = Record<string, string | undefined>

export function botUsername(env: Env) {
  const value = env.TELEGRAM_BOT_USERNAME?.trim()
  if (!value) return DEFAULT_BOT_USERNAME
  if (!BOT_USERNAME.test(value)) {
    throw new Error('TELEGRAM_BOT_USERNAME is not a Telegram bot handle')
  }
  return value
}

export function loginPayload(handoffId: string) {
  return `${LOGIN_PREFIX}${handoffId}`
}

export function loginDeepLink(handoffId: string, env: Env = process.env) {
  return `https://t.me/${botUsername(env)}?start=${loginPayload(handoffId)}`
}

export function isHandoffId(value: string) {
  return HANDOFF_ID.test(value)
}

export function parseLoginPayload(payload: string) {
  if (!payload.startsWith(LOGIN_PREFIX)) return undefined
  const id = payload.slice(LOGIN_PREFIX.length)
  return isHandoffId(id) ? id : undefined
}
