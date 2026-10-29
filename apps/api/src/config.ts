type Env = Record<string, string | undefined>

/** Only this public identifier is exposed to the browser, never bot credentials. */
export function telegramBotUsername(env: Env): string {
  const username = env.TELEGRAM_BOT_USERNAME?.trim()
  if (!username) return 'tilchiuz_bot'
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    throw new Error(
      'TELEGRAM_BOT_USERNAME must be 5-32 letters, digits or underscores',
    )
  }
  return username
}

type BootstrapConfigResult =
  | { ok: true; config: { port: number } }
  | { ok: false; errors: string[] }

export function readBootstrapConfig(env: Env): BootstrapConfigResult {
  const errors = productionConfigErrors(env)
  try {
    telegramBotUsername(env)
  } catch {
    errors.push(
      'TELEGRAM_BOT_USERNAME must be 5-32 letters, digits or underscores',
    )
  }
  const raw = env.PORT ?? '3001'
  const port = Number(raw)
  if (
    !/^\d+$/.test(raw) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    errors.push('PORT must be an integer between 1 and 65535')
  }
  return errors.length ? { ok: false, errors } : { ok: true, config: { port } }
}

const DEV_LIVEKIT_VALUES = new Set(['devkey', 'devsecret'])
const WEBHOOK_SECRET = /^[A-Za-z0-9_-]{32,256}$/
// Port 1 refuses at once, so a test that forgot its database fails fast
// instead of reaching whatever Postgres happens to run on this machine.
const UNCONFIGURED_TEST_URL = 'postgres://127.0.0.1:1/unconfigured'

/** The Postgres url, or a boot error. Tests that never query may run without one. */
export function databaseUrl(env: Env): string {
  const url = env.DATABASE_URL?.trim()
  if (url) return url
  if (env.NODE_ENV === 'test') return UNCONFIGURED_TEST_URL
  throw new Error(
    'DATABASE_URL is required: set it to a postgres:// connection string (see .env.example)',
  )
}

// Returns variable names only. Values never reach logs or responses.
export function productionConfigErrors(env: Env): string[] {
  if (env.NODE_ENV !== 'production') return []
  const errors: string[] = []
  const require = (name: string) => {
    if (!env[name]?.trim()) errors.push(`${name} is required`)
  }
  require('DATABASE_URL')
  require('REDIS_URL')
  if (!WEBHOOK_SECRET.test(env.TELEGRAM_WEBHOOK_SECRET ?? '')) {
    errors.push('TELEGRAM_WEBHOOK_SECRET must be 32-256 chars of [A-Za-z0-9_-]')
  }
  for (const name of ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']) {
    const value = env[name]?.trim() ?? ''
    if (!value || DEV_LIVEKIT_VALUES.has(value)) {
      errors.push(`${name} must be set to a non-dev value`)
    }
  }
  if ((env.LIVEKIT_API_SECRET?.trim().length ?? 0) < 32) {
    errors.push('LIVEKIT_API_SECRET must be at least 32 chars')
  }
  if (env.TILCHI_DEMO?.trim()) {
    errors.push('TILCHI_DEMO must be unset')
  }
  if (env.TILCHI_PREVIEW_ROLE?.trim()) {
    errors.push('TILCHI_PREVIEW_ROLE must be unset')
  }
  return errors
}
