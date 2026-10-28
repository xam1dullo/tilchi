import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthService } from '../auth/auth.service'
import { users as usersTable } from '../db/schema'
import { createMemoryKv } from '../redis/kv'
import { describeWithDatabase } from '../test/postgres'
import { SessionsRepository } from '../users/sessions.repository'
import { UsersRepository } from '../users/users.repository'
import type { BotApi } from './bot-api'
import { RegistrationService } from './registration.service'
import { parseBotUpdate } from './updates'

let nextUpdateId = 1000
const message = (text: string, id = 99, extra: object = {}) => ({
  update_id: nextUpdateId++,
  message: {
    text,
    from: { id, first_name: 'Tg Name' },
    chat: { id },
    ...extra,
  },
})
const tap = (data: string, id = 99) => ({
  callback_query: { id: 'cb', data, from: { id } },
})

type Reply = { text?: string; reply_markup?: Record<string, unknown> } | null

describeWithDatabase('RegistrationService', (current) => {
  const sent: Array<{ chat: string; text: string }> = []
  let service: RegistrationService
  let users: UsersRepository
  let sessions: SessionsRepository
  let auth: AuthService
  const kv = createMemoryKv()

  beforeEach(() => {
    sent.length = 0
    vi.stubEnv('ADMIN_CHAT_IDS', '1001, 1002')
    vi.stubEnv('PUBLIC_APP_URL', 'https://app.example')
    users = new UsersRepository(current().database)
    sessions = new SessionsRepository(current().database)
    auth = new AuthService(kv, users, sessions)
    const api = {
      send: async (chat: string, text: string) => {
        sent.push({ chat, text })
      },
    } as BotApi
    service = new RegistrationService(kv, users, auth, api)
  })
  afterEach(() => vi.unstubAllEnvs())

  async function say(update: unknown): Promise<Reply> {
    const action = parseBotUpdate(update)
    switch (action.type) {
      case 'start_registration':
        return service.start(action)
      case 'consent':
        return service.consent(action)
      case 'answer':
        return service.answer(action)
      case 'revoke_all':
        return service.revokeAll(action)
      default:
        return null
    }
  }

  const complete = async (id = 99) => {
    await say(tap('consent:yes', id))
    for (const text of [
      'Ada L',
      'orta',
      'school',
      '+998 90 111-22-33',
      'IELTS 7',
    ]) {
      await say(message(text, id))
    }
  }

  it('does not let a replayed update fill the next field', async () => {
    await say(tap('consent:yes'))
    const name = message('Ada L')
    await say(name)
    await say(name)
    await say(name)
    expect(await users.registration('99')).toMatchObject({
      name: 'Ada L',
      level: null,
    })
  })

  it('applies concurrent updates one after the other, none lost', async () => {
    await say(tap('consent:yes'))
    await Promise.all([say(message('Ada L')), say(message('orta'))])
    expect(await users.registration('99')).toMatchObject({
      name: 'Ada L',
      level: 'orta',
    })
  })

  it('drops an update older than the last one applied', async () => {
    await say(tap('consent:yes'))
    const old = message('stale')
    await say(message('Ada L'))
    await say(old)
    expect(await users.registration('99')).toMatchObject({
      name: 'Ada L',
      level: null,
    })
  })

  it('asks for consent first and stores nothing until it is given', async () => {
    const reply = await say(message('/start ielts_orta'))
    expect(reply?.text).toContain('transchegaraviy')
    expect(JSON.stringify(reply)).toContain('consent:yes')
    expect(await users.registration('99')).toBeNull()
  })

  it('walks the prompts, prefilling level and source from the payload', async () => {
    await say(message('/start ielts_orta'))
    const first = await say(tap('consent:yes'))
    expect(first?.text).toContain('Ismingiz')
    const afterName = await say(message('Ada L'))
    // level came from the payload, so the next prompt is study history
    expect(afterName?.text).toContain('oldin')
    await say(message('school'))
    const phone = await say(message('not a number'))
    expect(phone?.text).toContain('Tushunmadim')
    expect(JSON.stringify(phone?.reply_markup)).toContain('request_contact')
    await say(message('+998 90 111-22-33'))
    const done = await say(message('IELTS 7 in January'))
    expect(done?.text).toContain('Rahmat')
    expect(JSON.stringify(done)).toContain('https://app.example')
    const reg = await users.registration('99')
    expect(reg).toMatchObject({
      name: 'Ada L',
      level: 'orta',
      studyHistory: 'school',
      phone: '+998901112233',
      goal: 'IELTS 7 in January',
      source: 'ielts_orta',
      consentVersion: '2026-10-28',
    })
    expect(reg?.consentAt).toBeInstanceOf(Date)
  })

  it('alerts each admin chat once per registration, without the phone', async () => {
    await complete()
    expect(sent.map((m) => m.chat)).toEqual(['1001', '1002'])
    expect(sent[0]?.text).toContain('Ada L')
    expect(sent[0]?.text).toContain('orta')
    expect(sent[0]?.text).toContain('tg://user?id=99')
    expect(sent[0]?.text).not.toContain('998')
    // a redelivered final answer and a repeated /start do not alert again
    await say(message('IELTS 7'))
    await say(message('/start'))
    expect(sent).toHaveLength(2)
  })

  it('treats a registered learner as registered, even after a repeated consent tap', async () => {
    await complete()
    const again = await say(message('/start'))
    expect(again?.text).toContain('allaqachon')
    const tapped = await say(tap('consent:yes'))
    expect(tapped?.text).toContain('allaqachon')
    expect(sent).toHaveLength(2)
  })

  it('resumes with the next unanswered prompt', async () => {
    await say(message('/start'))
    await say(tap('consent:yes'))
    await say(message('Ada L'))
    const resumed = await say(message('/start'))
    expect(resumed?.text).toContain('Ingliz tili darajangiz')
    expect(await users.registration('99')).toMatchObject({ name: 'Ada L' })
  })

  it('ignores free text from someone who is not registering', async () => {
    expect(await say(message('hello'))).toBeNull()
    await say(message('/start'))
    expect(await say(message('hello'))).toBeNull()
  })

  it('asks consent again when the notice version changed', async () => {
    await complete()
    await current()
      .database.db.update(usersTable)
      .set({ consentVersion: 'old' })
    const reply = await say(message('/start'))
    expect(JSON.stringify(reply)).toContain('consent:yes')
  })

  it('stays silent for a deleted account', async () => {
    await complete()
    await current()
      .database.db.update(usersTable)
      .set({ deletedAt: new Date() })
    expect(await say(tap('consent:yes'))).toBeNull()
  })

  it('answers in the language of the telegram client', async () => {
    const reply = await say({
      message: {
        text: '/start',
        from: { id: 7, language_code: 'en' },
        chat: { id: 7 },
      },
    })
    expect(reply?.text).toContain('cross-border')
  })

  it('revokes every session, evicts the cache, and confirms', async () => {
    await complete()
    const reg = await users.registration('99')
    const userId = reg?.userId as string
    const far = new Date(Date.now() + 86_400_000)
    for (const tokenHash of ['h1', 'h2']) {
      await sessions.insert({
        userId,
        tokenHash,
        now: new Date(),
        idleExpiresAt: far,
        absoluteExpiresAt: far,
      })
    }
    await kv.set('session:cache:h1', '{"userId":"x"}', 300)
    const reply = await say(message('/revoke'))
    expect(reply?.text).toContain('(2)')
    expect(await kv.get('session:cache:h1')).toBeNull()
    // the shared marker makes a cold read that is mid-flight uncache the session
    expect(await kv.get('session:revoked:h1')).not.toBeNull()
    expect(await kv.get('session:revoked:h2')).not.toBeNull()
    for (const tokenHash of ['h1', 'h2']) {
      expect(await sessions.touch(tokenHash, new Date(), 1000)).toBeNull()
    }
    expect((await say(message('/chiqish')))?.text).toContain('(0)')
  })

  it('does not reach other users sessions', async () => {
    await complete(99)
    await complete(98)
    const other = (await users.registration('98'))?.userId as string
    const far = new Date(Date.now() + 86_400_000)
    await sessions.insert({
      userId: other,
      tokenHash: 'keep',
      now: new Date(),
      idleExpiresAt: far,
      absoluteExpiresAt: far,
    })
    await say(message('/revoke', 99))
    expect(await sessions.touch('keep', new Date(), 1000)).not.toBeNull()
  })
})
