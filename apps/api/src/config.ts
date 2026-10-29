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

export type StorageConfig = {
  /** Where the API reaches the object store (compose network). */
  endpoint: string
  /** Where browsers reach it; presigned URLs are signed for this host. */
  publicUrl: string
  bucket: string
  accessKey: string
  secretKey: string
  region: string
}

const DEV_STORAGE_VALUES = new Set([
  'tilchi-dev',
  'tilchi-dev-secret',
  'minioadmin',
])
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

const read = (env: Env, name: string, fallback = '') =>
  env[name]?.trim() || fallback

const ORIGIN = /^https?:\/\/[^/]+$/

function origin(name: string, value: string) {
  const trimmed = value.replace(/\/+$/, '')
  if (!ORIGIN.test(trimmed)) {
    throw new Error(`${name} must be an http(s) origin without a path`)
  }
  return trimmed
}

/** S3-compatible audio storage (ADR 0011). Dev defaults point at a local MinIO. */
export function storageConfig(env: Env): StorageConfig {
  const endpoint = origin(
    'S3_ENDPOINT',
    read(env, 'S3_ENDPOINT', 'http://localhost:9000'),
  )
  const bucket = read(env, 'S3_BUCKET', 'tilchi-audio')
  if (!BUCKET.test(bucket)) {
    throw new Error('S3_BUCKET is not a valid bucket name')
  }
  return {
    endpoint,
    publicUrl: origin('S3_PUBLIC_URL', read(env, 'S3_PUBLIC_URL', endpoint)),
    bucket,
    accessKey: read(env, 'S3_ACCESS_KEY', 'tilchi-dev'),
    secretKey: read(env, 'S3_SECRET_KEY', 'tilchi-dev-secret'),
    region: read(env, 'S3_REGION', 'us-east-1'),
  }
}

function storageErrors(env: Env): string[] {
  const errors = ['S3_ENDPOINT', 'S3_PUBLIC_URL']
    .filter((name) => !read(env, name))
    .map((name) => `${name} is required`)
  for (const name of ['S3_ACCESS_KEY', 'S3_SECRET_KEY']) {
    if (DEV_STORAGE_VALUES.has(read(env, name)) || !read(env, name)) {
      errors.push(`${name} must be set to a non-dev value`)
    }
  }
  if (read(env, 'S3_SECRET_KEY').length < 16) {
    errors.push('S3_SECRET_KEY must be at least 16 chars')
  }
  if (!read(env, 'S3_PUBLIC_URL').startsWith('https://')) {
    errors.push('S3_PUBLIC_URL must be https in production')
  }
  try {
    storageConfig(env)
  } catch (error) {
    errors.push((error as Error).message)
  }
  return errors
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
  errors.push(...storageErrors(env))
  if (env.TILCHI_DEMO?.trim()) {
    errors.push('TILCHI_DEMO must be unset')
  }
  if (env.TILCHI_PREVIEW_ROLE?.trim()) {
    errors.push('TILCHI_PREVIEW_ROLE must be unset')
  }
  return errors
}
