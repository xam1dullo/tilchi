import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from '../app.module'
import { AuthService } from '../auth/auth.service'
import { createTestDb } from '../db/testing'

export const TEST_ADMIN = '1000'
export const TEST_TEACHER = '2000'
export const TEST_TEACHER_2 = '2001'
export const WEBHOOK_SECRET = 'test-webhook-secret'
export const LIVEKIT_TEST_KEY = 'test-livekit-key'
export const LIVEKIT_TEST_SECRET = 'test-livekit-secret-0123456789-abcdefghij'

const TEST_ENV = {
  NODE_ENV: 'test',
  TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
  LIVEKIT_API_KEY: LIVEKIT_TEST_KEY,
  LIVEKIT_API_SECRET: LIVEKIT_TEST_SECRET,
  TILCHI_ADMIN_TELEGRAM_IDS: TEST_ADMIN,
  TILCHI_TEACHER_TELEGRAM_IDS: `${TEST_TEACHER},${TEST_TEACHER_2}`,
}

// The real Nest app on an in-process Postgres built from the committed
// migrations. `env` is applied before boot and restored by close().
export async function bootTestApp(
  env: Record<string, string | undefined> = {},
) {
  const applied = { ...TEST_ENV, ...env }
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(applied)) {
    previous.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  const db = await createTestDb()
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(db),
    { logger: false, abortOnError: false },
  )
  app.set('trust proxy', 1)
  await app.listen(0, '127.0.0.1')
  const base = await app.getUrl()
  return {
    app,
    db,
    base,
    async close() {
      await app.close()
      await db.$client.close()
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    },
  }
}

let sequence = 0

// Signs a Telegram account in through the real handoff (start, confirm, claim)
// and returns the session cookie pair with the user's id. Each call uses its
// own address so a test is never stopped by the /auth/start rate limit.
export async function signInAs(
  app: INestApplication,
  telegramId: string,
  name?: string,
) {
  const auth = app.get(AuthService)
  const { handoffId, claim } = auth.start({ ip: `test-${sequence++}` })
  if (!(await auth.confirm(handoffId, { id: telegramId, name }))) {
    throw new Error(`sign-in refused for ${telegramId}`)
  }
  const opened = auth.claim(claim)
  if (opened.status !== 'confirmed') throw new Error(opened.status)
  const user = auth.read(opened.token)
  if (!user) throw new Error('session vanished')
  return { cookie: `__Host-tilchi_sid=${opened.token}`, userId: user.userId }
}

// biome-ignore lint/suspicious/noExplicitAny: test helper; responses are untyped JSON
export type Reply = { status: number; json: any; headers: Headers }

export function client(base: string) {
  return async (
    method: string,
    path: string,
    options: {
      cookie?: string
      body?: unknown
      headers?: Record<string, string>
    } = {},
  ): Promise<Reply> => {
    const headers: Record<string, string> = { ...options.headers }
    if (options.cookie) headers.cookie = options.cookie
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const text = await response.text()
    return {
      status: response.status,
      json: text ? JSON.parse(text) : undefined,
      headers: response.headers,
    }
  }
}
