import { createHash } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AccessToken } from 'livekit-server-sdk'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AttendanceRepository } from './attendance.repository'
import { LivekitWebhook } from './livekit-webhook'
import { LivekitWebhookController } from './livekit-webhook.controller'

const KEY = 'devkey'
const SECRET = 'devsecret-devsecret-devsecret-0123'
const recorded: unknown[] = []
let app: INestApplication
let url: string

beforeEach(async () => {
  vi.stubEnv('LIVEKIT_API_KEY', KEY)
  vi.stubEnv('LIVEKIT_API_SECRET', SECRET)
  recorded.length = 0
  const fake = {
    lessonIdForRoom: async () => 'lesson-1',
    userExists: async () => true,
    record: async (input: unknown) => {
      recorded.push(input)
      return true
    },
  }
  const moduleRef = await Test.createTestingModule({
    controllers: [LivekitWebhookController],
    providers: [
      LivekitWebhook,
      { provide: AttendanceRepository, useValue: fake },
    ],
  }).compile()
  app = moduleRef.createNestApplication()
  await app.listen(0)
  url = `${await app.getUrl()}/api/meet/webhook`.replace('[::1]', '127.0.0.1')
})

afterEach(async () => {
  await app.close()
  vi.unstubAllEnvs()
})

const body = JSON.stringify({
  event: 'participant_joined',
  id: 'EV_1',
  room: { name: 'lesson-x' },
  participant: { identity: 'u1' },
})

async function post(authorization?: string) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/webhook+json',
      ...(authorization ? { authorization } : {}),
    },
    body,
  })
}

it('accepts a LiveKit-signed raw body over HTTP', async () => {
  const token = new AccessToken(KEY, SECRET)
  token.sha256 = createHash('sha256').update(body).digest('base64')
  const response = await post(await token.toJwt())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ recorded: true })
  expect(recorded).toHaveLength(1)
})

it('rejects an unsigned request with 401 and records nothing', async () => {
  expect((await post()).status).toBe(401)
  expect(recorded).toHaveLength(0)
})
