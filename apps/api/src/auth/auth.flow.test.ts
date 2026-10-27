import 'reflect-metadata'
import { createHmac } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AppModule } from '../app.module'
import { HANDOFF_COOKIE, HANDOFF_TTL_MS, SESSION_COOKIE } from './policy'

const HOOK = 'test-webhook-secret'
const BOT_TOKEN = 'TEST_BOT_TOKEN_PLACEHOLDER'
const env = {
  NODE_ENV: 'test',
  REDIS_URL: '',
  TELEGRAM_WEBHOOK_SECRET: HOOK,
  TELEGRAM_BOT_TOKEN: BOT_TOKEN,
  TELEGRAM_TEACHER_ALLOWLIST: '200',
  TELEGRAM_ADMIN_ALLOWLIST: '300',
}
const stubAll = () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
}

let app: INestApplication
let base = ''
let nextIp = 0

beforeAll(async () => {
  stubAll()
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = mod.createNestApplication()
  await app.listen(0)
  base = await app.getUrl()
})
afterAll(() => app.close())
beforeEach(stubAll)
afterEach(() => vi.unstubAllEnvs())

// biome-ignore lint/suspicious/noExplicitAny: test-only response bodies
type Json = any
type Reply = { status: number; body: Json; setCookie: string[] }

async function send(
  path: string,
  init: {
    method?: string
    cookie?: string
    body?: unknown
    headers?: Record<string, string>
  } = {},
): Promise<Reply> {
  const method = init.method ?? 'POST'
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...init.headers,
    },
    body: method === 'GET' ? undefined : JSON.stringify(init.body ?? {}),
  })
  const text = await res.text()
  return {
    status: res.status,
    body: text ? JSON.parse(text) : null,
    setCookie: res.headers.getSetCookie(),
  }
}

const cookiePair = (setCookie: string[], name: string) =>
  setCookie.find((c) => c.startsWith(`${name}=`))?.split(';')[0]

const webhook = (update: unknown, secret: string | undefined = HOOK) =>
  send('/bot/webhook', {
    body: update,
    headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {},
  })

const compact = (handoffId: string) => handoffId.replace(/-/g, '')
const tgStart = (id: number, name: string, handoffId: string) =>
  webhook({
    message: {
      text: `/start ${compact(handoffId)}`,
      from: { id, first_name: name },
      chat: { id },
    },
  })
const tgTap = (id: number, handoffId: string) =>
  webhook({
    callback_query: {
      id: 'cb',
      data: `confirm:${compact(handoffId)}`,
      from: { id },
    },
  })

async function startHandoff(headers: Record<string, string> = {}) {
  nextIp += 1
  const started = await send('/auth/start', {
    headers: {
      'x-real-ip': `10.1.0.${nextIp}`,
      'user-agent': 'TestBrowser/1.0',
      ...headers,
    },
  })
  expect(started.status).toBe(201)
  const binding = cookiePair(started.setCookie, HANDOFF_COOKIE)
  expect(binding).toBeTruthy()
  return {
    handoffId: started.body.handoffId as string,
    binding: binding as string,
    started,
  }
}

async function login(id: number, name: string) {
  const { handoffId, binding } = await startHandoff()
  await tgStart(id, name, handoffId)
  await tgTap(id, handoffId)
  const claimed = await send('/auth/confirm', {
    cookie: binding,
    body: { handoffId },
  })
  expect(claimed.status).toBe(201)
  return cookiePair(claimed.setCookie, SESSION_COOKIE) as string
}

const whoami = async (cookie?: string) =>
  (await send('/auth/session', { method: 'GET', cookie })).body.user

describe('boot', () => {
  it('compiles AppModule with the controllers wired to AuthService', async () => {
    const health = await send('/api/health', { method: 'GET' })
    expect(health.body).toEqual({ ok: true, service: 'tilchi-api' })
    expect((await send('/auth/session', { method: 'GET' })).body).toEqual({
      user: null,
    })
  })
})

describe('POST /auth/start', () => {
  it('hands the browser a binding cookie and keeps the secret out of the body', async () => {
    const { started, binding } = await startHandoff()
    const header =
      started.setCookie.find((c) => c.startsWith(`${HANDOFF_COOKIE}=`)) ?? ''
    for (const part of [
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Path=/',
      `Max-Age=${HANDOFF_TTL_MS / 1000}`,
    ]) {
      expect(header).toContain(part)
    }
    expect(header).not.toContain('Domain=')
    expect(JSON.stringify(started.body)).not.toContain(binding.split('=')[1])
    expect(started.body.deepLink).toContain(compact(started.body.handoffId))
  })

  it('stays rate limited at five per minute per ip', async () => {
    const codes: number[] = []
    for (let i = 0; i < 6; i += 1) {
      codes.push(
        (await send('/auth/start', { headers: { 'x-real-ip': '10.9.9.9' } }))
          .status,
      )
    }
    expect(codes).toEqual([201, 201, 201, 201, 201, 429])
  })
})

describe('POST /auth/confirm requires Telegram confirmation', () => {
  it('never mints a session before the bot confirmed', async () => {
    const { handoffId, binding } = await startHandoff()
    const early = await send('/auth/confirm', {
      cookie: binding,
      body: { handoffId },
    })
    expect(early.status).toBe(409)
    expect(early.setCookie).toEqual([])

    await tgStart(111, 'Alice', handoffId)
    const pressedStartOnly = await send('/auth/confirm', {
      cookie: binding,
      body: { handoffId },
    })
    expect(pressedStartOnly.status).toBe(409)
    expect(pressedStartOnly.setCookie).toEqual([])
  })

  it('rejects unknown, empty, and cookie-less claims without a session', async () => {
    expect(
      (await send('/auth/confirm', { body: { handoffId: 'nope' } })).status,
    ).toBe(410)
    expect((await send('/auth/confirm', { body: {} })).status).toBe(410)
    const { handoffId } = await startHandoff()
    const noCookie = await send('/auth/confirm', { body: { handoffId } })
    expect(noCookie.status).toBe(403)
    expect(noCookie.setCookie).toEqual([])
  })

  it('mints the session for the real telegram user after the bot confirmed', async () => {
    const { handoffId, binding } = await startHandoff()
    const asked = await tgStart(111, 'Alice', handoffId)
    expect(asked.body.method).toBe('sendMessage')
    expect(asked.body.text).toContain('10.1.0.')
    expect(asked.body.text).toContain('TestBrowser/1.0')
    expect(asked.body.reply_markup.inline_keyboard[0][0].callback_data).toBe(
      `confirm:${compact(handoffId)}`,
    )
    expect((await tgTap(111, handoffId)).body.text).toContain('Tasdiqlandi')

    const claimed = await send('/auth/confirm', {
      cookie: binding,
      body: { handoffId },
    })
    expect(claimed.status).toBe(201)
    const session =
      claimed.setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`)) ?? ''
    for (const part of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) {
      expect(session).toContain(part)
    }
    expect(session).not.toContain('Domain=')
    expect(
      claimed.setCookie.find((c) => c.startsWith(`${HANDOFF_COOKIE}=;`)),
    ).toContain('Max-Age=0')
    expect(JSON.stringify(claimed.body)).not.toContain(
      session.split(';')[0].split('=')[1],
    )

    const me = await whoami(session.split(';')[0])
    expect(me).toMatchObject({ name: 'Alice', role: 'learner' })
    expect(claimed.body.user.id).toBe(me.userId)
    expect((await whoami(await login(111, 'Alice'))).userId).toBe(me.userId)
  })

  it('gives allowlisted telegram ids teacher and admin roles', async () => {
    expect((await whoami(await login(200, 'Teach'))).role).toBe('teacher')
    expect((await whoami(await login(300, 'Boss'))).role).toBe('admin')
  })

  it('is single-use', async () => {
    const { handoffId, binding } = await startHandoff()
    await tgStart(111, 'Alice', handoffId)
    await tgTap(111, handoffId)
    expect(
      (await send('/auth/confirm', { cookie: binding, body: { handoffId } }))
        .status,
    ).toBe(201)
    const replay = await send('/auth/confirm', {
      cookie: binding,
      body: { handoffId },
    })
    expect(replay.status).toBe(410)
    expect(replay.setCookie).toEqual([])
    expect((await tgTap(111, handoffId)).body.text).toContain('eskirgan')
  })

  it('only releases the session to the browser that started the handoff', async () => {
    const { handoffId, binding } = await startHandoff()
    const other = await startHandoff()
    await tgStart(111, 'Alice', handoffId)
    await tgTap(111, handoffId)
    for (const cookie of [
      undefined,
      other.binding,
      `${HANDOFF_COOKIE}=guess`,
    ]) {
      const stolen = await send('/auth/confirm', {
        cookie,
        body: { handoffId },
      })
      expect(stolen.status).toBe(403)
      expect(stolen.setCookie).toEqual([])
    }
    expect(
      (await send('/auth/confirm', { cookie: binding, body: { handoffId } }))
        .status,
    ).toBe(201)
  })

  it('binds the first telegram user and ignores everyone else', async () => {
    const { handoffId, binding } = await startHandoff()
    await tgStart(111, 'Alice', handoffId)
    expect((await tgStart(666, 'Mallory', handoffId)).body.text).toContain(
      'eskirgan',
    )
    expect((await tgTap(666, handoffId)).body.text).toContain('sizniki emas')
    expect(
      (await send('/auth/confirm', { cookie: binding, body: { handoffId } }))
        .status,
    ).toBe(409)
    await tgTap(111, handoffId)
    const claimed = await send('/auth/confirm', {
      cookie: binding,
      body: { handoffId },
    })
    expect(
      (await whoami(cookiePair(claimed.setCookie, SESSION_COOKIE))).name,
    ).toBe('Alice')
  })

  it('refuses confirm in production until the webhook secret is set', async () => {
    const { handoffId, binding } = await startHandoff()
    await tgStart(111, 'Alice', handoffId)
    await tgTap(111, handoffId)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '')
    const refused = await send('/auth/confirm', {
      cookie: binding,
      body: { handoffId },
    })
    expect(refused.status).toBe(503)
    expect(refused.setCookie).toEqual([])
    expect((await webhook({}, undefined)).status).toBe(503)

    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', HOOK)
    expect((await webhook({}, 'wrong')).status).toBe(401)
    expect(
      (await send('/auth/confirm', { cookie: binding, body: { handoffId } }))
        .status,
    ).toBe(201)
  })

  it('expires a handoff after five minutes', async () => {
    const { handoffId, binding } = await startHandoff()
    await tgStart(111, 'Alice', handoffId)
    await tgTap(111, handoffId)
    const real = Date.now
    Date.now = () => real() + HANDOFF_TTL_MS + 1000
    try {
      expect(
        (await send('/auth/confirm', { cookie: binding, body: { handoffId } }))
          .status,
      ).toBe(410)
    } finally {
      Date.now = real
    }
  })

  it('ignores a spoofed x-forwarded-for when naming the requester', async () => {
    const { handoffId } = await startHandoff({
      'x-real-ip': '10.2.0.1',
      'x-forwarded-for': '6.6.6.6',
    })
    const asked = await tgStart(111, 'Alice', handoffId)
    expect(asked.body.text).toContain('10.2.0.1 / TestBrowser/1.0')
    expect(asked.body.text).not.toContain('6.6.6.6')
  })
})

describe('Mini App initData', () => {
  const sign = (fields: Record<string, string>, token = BOT_TOKEN) => {
    const check = Object.entries(fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
    const secret = createHmac('sha256', 'WebAppData').update(token).digest()
    const hash = createHmac('sha256', secret).update(check).digest('hex')
    return new URLSearchParams({ ...fields, hash }).toString()
  }
  const user = JSON.stringify({ id: 42, first_name: 'Mini' })
  const nowSec = () => String(Math.floor(Date.now() / 1000))

  it('opens the same session for a verified payload', async () => {
    const opened = await send('/auth/miniapp', {
      body: { initData: sign({ auth_date: nowSec(), user }) },
    })
    expect(opened.status).toBe(201)
    expect(
      await whoami(cookiePair(opened.setCookie, SESSION_COOKIE)),
    ).toMatchObject({
      name: 'Mini',
      role: 'learner',
    })
  })

  it('rejects forged, foreign-token, stale, and token-less payloads', async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 7200)
    const bodies = [
      { initData: sign({ auth_date: nowSec(), user }).replace('Mini', 'Evil') },
      { initData: sign({ auth_date: nowSec(), user }, 'OTHER_TOKEN') },
      { initData: sign({ auth_date: stale, user }) },
      { initData: '' },
      {},
    ]
    for (const body of bodies) {
      const reply = await send('/auth/miniapp', { body })
      expect(reply.status).toBe(401)
      expect(reply.setCookie).toEqual([])
    }
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    const noToken = await send('/auth/miniapp', {
      body: { initData: sign({ auth_date: nowSec(), user }) },
    })
    expect(noToken.status).toBe(401)
  })
})

describe('sessions', () => {
  it('logout clears this cookie; a bearer header never counts as a session', async () => {
    const cookie = await login(400, 'Multi')
    const out = await send('/auth/logout', { cookie })
    expect(out.setCookie.join()).toContain('Max-Age=0')
    expect(await whoami(cookie)).toBeNull()
    const bearer = await send('/auth/session', {
      method: 'GET',
      headers: { authorization: 'Bearer abc' },
    })
    expect(bearer.status).toBe(400)
    expect(await whoami(`${SESSION_COOKIE}=forged`)).toBeNull()
    expect(await whoami(`${SESSION_COOKIE}=%E0%A4%A`)).toBeNull()
  })

  it('issues meet tickets only to a session, and the ticket is not the session', async () => {
    expect((await send('/api/meet/ticket')).status).toBe(401)
    const cookie = await login(500, 'Meet')
    const issued = await send('/api/meet/ticket', { cookie })
    expect(issued.status).toBe(201)
    expect(JSON.stringify(issued.body)).not.toContain(cookie.split('=')[1])
    expect(issued.setCookie).toEqual([])
  })
})
