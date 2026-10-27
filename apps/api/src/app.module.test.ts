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

  it('requires a cookie session for a meet ticket', async () => {
    const response = await fetch(`${base}/api/meet/ticket`, { method: 'POST' })
    expect(response.status).toBe(401)
  })
})
