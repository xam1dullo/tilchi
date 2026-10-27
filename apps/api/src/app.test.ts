import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type Reply,
  WEBHOOK_SECRET,
  bootTestApp,
  client,
} from './testing/harness'

type Booted = Awaited<ReturnType<typeof bootTestApp>>

function cookiePair(reply: Reply, name: string) {
  const header = reply.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`))
  return header?.split(';')[0]
}

function setCookie(reply: Reply, name: string) {
  return reply.headers.getSetCookie().find((v) => v.startsWith(`${name}=`))
}

describe('api boot', () => {
  let booted: Booted
  beforeAll(async () => {
    booted = await bootTestApp()
  })
  afterAll(async () => {
    await booted?.close()
  })

  it('starts with every controller wired', async () => {
    const reply = await client(booted.base)('GET', '/api/health')
    expect(reply.json).toEqual({ ok: true, service: 'tilchi-api' })
  })

  it('has no public route that opens a session without telegram', async () => {
    const reply = await client(booted.base)('POST', '/auth/confirm', {
      body: { handoffId: 'anything' },
    })
    expect(reply.status).toBe(404)
    expect(reply.headers.getSetCookie()).toEqual([])
  })
})

describe('telegram login over http', () => {
  let booted: Booted
  let call: ReturnType<typeof client>
  // `null` sends no secret header at all; omitting the argument sends the right one.
  const webhook = (body: unknown, secret: string | null = WEBHOOK_SECRET) =>
    call('POST', '/bot/webhook', {
      body,
      headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {},
    })

  beforeAll(async () => {
    booted = await bootTestApp()
    call = client(booted.base)
  })
  afterAll(async () => {
    await booted?.close()
  })

  it('opens the session only in the browser that started it, after the bot confirms', async () => {
    const started = await call('POST', '/auth/start', {
      body: {},
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36',
      },
    })
    expect(started.status).toBe(201)
    const { handoffId, deepLink } = started.json
    expect(deepLink).toBe(`https://t.me/tilchiuz_bot?start=login_${handoffId}`)
    expect(Object.keys(started.json).sort()).toEqual([
      'deepLink',
      'expiresInSeconds',
      'handoffId',
    ])
    const handoffCookie = cookiePair(started, '__Host-tilchi_handoff') as string
    expect(setCookie(started, '__Host-tilchi_handoff')).toMatch(
      /HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=300$/,
    )

    expect(
      (await call('POST', '/auth/claim', { cookie: handoffCookie })).status,
    ).toBe(202)

    const prompt = await webhook({
      message: {
        chat: { id: 555, type: 'private' },
        from: {
          id: 555,
          is_bot: false,
          first_name: 'Aziza',
          language_code: 'en',
        },
        text: `/start login_${handoffId}`,
      },
    })
    expect(prompt.status).toBe(200)
    expect(prompt.json.method).toBe('sendMessage')
    expect(prompt.json.text).toContain('Chrome, Windows')

    const forged = await call('POST', '/auth/claim', {
      cookie: `__Host-tilchi_handoff=${handoffId}.forged`,
    })
    expect(forged.status).toBe(410)
    expect(cookiePair(forged, '__Host-tilchi_sid')).toBeUndefined()

    const confirmed = await webhook({
      callback_query: {
        id: '9001',
        from: {
          id: 555,
          is_bot: false,
          first_name: 'Aziza',
          language_code: 'en',
        },
        message: { message_id: 3, chat: { id: 555, type: 'private' } },
        data: `confirm:${handoffId}`,
      },
    })
    expect(confirmed.json.method).toBe('editMessageText')

    const claimed = await call('POST', '/auth/claim', { cookie: handoffCookie })
    expect(claimed.status).toBe(201)
    expect(claimed.json).toEqual({ status: 'confirmed' })
    expect(setCookie(claimed, '__Host-tilchi_sid')).toMatch(
      /^__Host-tilchi_sid=[^;]+; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=2592000$/,
    )
    expect(claimed.headers.getSetCookie().join('\n')).not.toMatch(/Domain=/i)
    expect(setCookie(claimed, '__Host-tilchi_handoff')).toMatch(
      /^__Host-tilchi_handoff=; .*Max-Age=0$/,
    )
    const sid = cookiePair(claimed, '__Host-tilchi_sid') as string

    const session = await call('GET', '/auth/session', { cookie: sid })
    expect(session.json).toEqual({
      user: { userId: expect.any(String), role: 'learner', name: 'Aziza' },
    })
    expect(JSON.stringify(session.json)).not.toContain(sid.split('=')[1])

    expect(
      (await call('POST', '/auth/claim', { cookie: handoffCookie })).status,
    ).toBe(410)

    const bearer = await call('GET', '/auth/session', {
      headers: { authorization: `Bearer ${sid.split('=')[1]}` },
    })
    expect(bearer.status).toBe(400)

    await call('POST', '/auth/logout', { cookie: sid })
    expect((await call('GET', '/auth/session', { cookie: sid })).json).toEqual({
      user: null,
    })
  })

  it('gives an allow-listed telegram account its role', async () => {
    const started = await call('POST', '/auth/start', { body: {} })
    const { handoffId } = started.json
    await webhook({
      callback_query: {
        id: '1',
        from: { id: 2000, is_bot: false, first_name: 'Mukhtasar' },
        data: `confirm:${handoffId}`,
      },
    })
    const claimed = await call('POST', '/auth/claim', {
      cookie: cookiePair(started, '__Host-tilchi_handoff'),
    })
    const session = await call('GET', '/auth/session', {
      cookie: cookiePair(claimed, '__Host-tilchi_sid'),
    })
    expect(session.json.user).toMatchObject({
      role: 'teacher',
      name: 'Mukhtasar',
    })
  })

  it('rejects a webhook call without the secret header', async () => {
    const update = { message: { text: '/start' } }
    expect((await webhook(update, null)).status).toBe(401)
    expect((await webhook(update, 'wrong')).status).toBe(401)
    expect((await webhook(update)).status).toBe(200)
  })
})

describe('telegram webhook without a secret', () => {
  it('is refused when production or an unnamed environment has none, and open on a dev machine', async () => {
    for (const NODE_ENV of ['production', 'staging', undefined]) {
      const refused = await bootTestApp({
        NODE_ENV,
        TELEGRAM_WEBHOOK_SECRET: undefined,
      })
      try {
        const reply = await client(refused.base)('POST', '/bot/webhook', {
          body: {},
        })
        expect(reply.status).toBe(503)
        expect(reply.json).toEqual({ error: 'webhook_disabled' })
      } finally {
        await refused.close()
      }
    }
    const dev = await bootTestApp({
      NODE_ENV: 'development',
      TELEGRAM_WEBHOOK_SECRET: undefined,
    })
    try {
      const reply = await client(dev.base)('POST', '/bot/webhook', { body: {} })
      expect(reply.status).toBe(200)
    } finally {
      await dev.close()
    }
  })
})

describe('auth start rate limit', () => {
  let booted: Booted
  beforeAll(async () => {
    booted = await bootTestApp()
  })
  afterAll(async () => {
    await booted?.close()
  })

  it('ignores a client-chosen telegram key', async () => {
    const call = client(booted.base)
    const statuses: number[] = []
    for (let i = 0; i < 4; i++) {
      const reply = await call('POST', '/auth/start', {
        body: { telegramKey: 'victim' },
      })
      statuses.push(reply.status)
    }
    expect(statuses).toEqual([201, 201, 201, 201])
  })

  // The edge proxy writes the right-most entry; everything to its left is
  // client-chosen, so a limiter reading the first entry would never trip.
  it('ignores the client-chosen entries of X-Forwarded-For', async () => {
    const call = client(booted.base)
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const reply = await call('POST', '/auth/start', {
        body: {},
        headers: { 'x-forwarded-for': `198.51.100.${i}, 203.0.113.7` },
      })
      statuses.push(reply.status)
    }
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201])
    expect(statuses[5]).toBe(429)
  })
})
