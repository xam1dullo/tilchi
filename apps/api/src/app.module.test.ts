import 'reflect-metadata'
import type { AddressInfo } from 'node:net'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module'

let app: NestExpressApplication
let base: string

beforeAll(async () => {
  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    abortOnError: false,
  })
  app.set('trust proxy', 1)
  await app.listen(0, '127.0.0.1')
  const { port } = app.getHttpServer().address() as AddressInfo
  base = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await app?.close()
})

describe('AppModule boot', () => {
  it('resolves every controller and serves health', async () => {
    const response = await fetch(`${base}/api/health`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, service: 'tilchi-api' })
  })

  it('refuses a bearer session', async () => {
    const response = await fetch(`${base}/auth/session`, {
      headers: { authorization: 'Bearer stolen' },
    })
    expect(response.status).toBe(400)
  })

  it('does not mint a session for a handoff the bot has not approved', async () => {
    const start = await fetch(`${base}/auth/start`, { method: 'POST' })
    expect(start.status).toBe(201)
    const { handoffId } = (await start.json()) as { handoffId: string }
    const confirm = await fetch(`${base}/auth/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handoffId }),
    })
    expect(confirm.status).toBe(409)
    expect(confirm.headers.get('set-cookie')).toBeNull()
  })

  it('requires a cookie session for a meet ticket', async () => {
    const response = await fetch(`${base}/api/meet/ticket`, { method: 'POST' })
    expect(response.status).toBe(401)
  })
})
