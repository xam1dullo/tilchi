import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { describeWithDatabase } from '../test/postgres'
import { adminChatIds, publicAppUrl } from './bot-api'

const HOOK = 'test-webhook-secret'

describe('bot env helpers', () => {
  it('accepts only an https app url', () => {
    expect(publicAppUrl({ PUBLIC_APP_URL: 'https://a.uz' })).toBe(
      'https://a.uz',
    )
    expect(publicAppUrl({ PUBLIC_APP_URL: 'http://a.uz' })).toBeUndefined()
    expect(publicAppUrl({})).toBeUndefined()
  })

  it('reads admin chats from the list or the single legacy variable', () => {
    expect(adminChatIds({ ADMIN_CHAT_IDS: '1, 2,,' })).toEqual(['1', '2'])
    expect(adminChatIds({ ADMIN_CHAT_ID: '5' })).toEqual(['5'])
    expect(adminChatIds({})).toEqual([])
  })
})

describeWithDatabase('bot webhook routing over HTTP', (current) => {
  let app: INestApplication
  let base = ''

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('REDIS_URL', '')
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', HOOK)
    vi.stubEnv('DATABASE_URL', current().url)
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = mod.createNestApplication()
    await app.listen(0)
    base = await app.getUrl()
  })
  afterAll(async () => {
    await app.close()
    vi.unstubAllEnvs()
  })

  const hook = async (text: string, id = 55) => {
    const res = await fetch(`${base}/bot/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': HOOK,
      },
      body: JSON.stringify({
        message: { text, from: { id }, chat: { id } },
      }),
    })
    return res.json() as Promise<{ text?: string; action?: string }>
  }

  it('starts plain registration on a bare /start', async () => {
    expect((await hook('/start')).text).toContain('rozilik')
  })

  it('starts prefilled registration on a lead payload, not a login', async () => {
    expect((await hook('/start ielts_orta')).text).toContain('rozilik')
  })

  it('keeps an unknown handoff-shaped payload as an expired login', async () => {
    const reply = await hook('/start 01a17ecc6cf37882b3be7d39ce083092')
    expect(reply.text).toContain('eskirgan')
  })

  it('ignores chatter from someone not registering', async () => {
    expect((await hook('hello', 56)).action).toBe('ignore')
  })
})
