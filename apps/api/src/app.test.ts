import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module'
import { AuthService } from './auth/auth.service'

let app: INestApplication
let base: string

beforeAll(async () => {
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  })
  await app.listen(0, '127.0.0.1')
  base = await app.getUrl()
})

afterAll(async () => {
  await app?.close()
})

function cookiePair(response: Response, name: string) {
  const header = response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`))
  return header?.split(';')[0]
}

describe('api boot', () => {
  it('starts with every controller wired', async () => {
    const response = await fetch(`${base}/api/health`)
    expect(await response.json()).toEqual({ ok: true, service: 'tilchi-api' })
  })
})

describe('telegram handoff', () => {
  it('has no public route that opens a session without telegram', async () => {
    const response = await fetch(`${base}/auth/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handoffId: 'anything' }),
    })
    expect(response.status).toBe(404)
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('opens the session only in the browser that started the handoff', async () => {
    const started = await fetch(`${base}/auth/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const { handoffId } = (await started.json()) as { handoffId: string }
    const handoffCookie = cookiePair(started, '__Host-tilchi_handoff')
    expect(handoffCookie).toBeDefined()

    const claim = (cookie: string) =>
      fetch(`${base}/auth/claim`, { method: 'POST', headers: { cookie } })

    expect((await claim(handoffCookie as string)).status).toBe(202)

    app.get(AuthService).confirm(handoffId, 'tg-42')

    const stranger = await claim(`__Host-tilchi_handoff=${handoffId}.forged`)
    expect(stranger.status).toBe(410)
    expect(cookiePair(stranger, '__Host-tilchi_sid')).toBeUndefined()

    const claimed = await claim(handoffCookie as string)
    expect(claimed.status).toBe(201)
    const sid = cookiePair(claimed, '__Host-tilchi_sid')
    expect(sid).toBeDefined()

    const session = await fetch(`${base}/auth/session`, {
      headers: { cookie: sid as string },
    })
    expect(await session.json()).toMatchObject({ user: { role: 'learner' } })

    expect((await claim(handoffCookie as string)).status).toBe(410)
  })
})

describe('meet token', () => {
  it('refuses a caller without a session cookie', async () => {
    const response = await fetch(`${base}/api/meet/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room: 'lesson-1' }),
    })
    expect(response.status).toBe(401)
  })
})

describe('auth start rate limit', () => {
  it('ignores a client-chosen telegram key', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 4; i++) {
      const response = await fetch(`${base}/auth/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ telegramKey: 'victim' }),
      })
      statuses.push(response.status)
    }
    expect(statuses).toEqual([201, 201, 201, 201])
  })

  it('keys on the connection, not a client-sent X-Forwarded-For', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const response = await fetch(`${base}/auth/start`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': `198.51.100.${i}`,
        },
        body: '{}',
      })
      statuses.push(response.status)
    }
    expect(statuses).toContain(429)
  })
})
