type Env = Record<string, string | undefined>

const DEV_LIVEKIT_VALUES = new Set(['devkey', 'devsecret'])
const WEBHOOK_SECRET = /^[A-Za-z0-9_-]{32,256}$/

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
