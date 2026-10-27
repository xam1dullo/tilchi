import { describe, expect, it } from 'vitest'
import { AuthService } from '../auth/auth.service'
import { RoleAllowlist } from '../users/roles'
import { fakeUsers } from '../users/testing'
import { copy } from './copy'
import { BotService } from './bot.service'

const UA = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36'

function setup(teachers: string[] = []) {
  const auth = new AuthService(
    fakeUsers(),
    new RoleAllowlist(new Set(), new Set(teachers)),
  )
  return { auth, bot: new BotService(auth) }
}

function startMessage(text: string, userId = 555) {
  return {
    message: {
      chat: { id: userId, type: 'private' },
      from: {
        id: userId,
        is_bot: false,
        first_name: 'Aziza',
        language_code: 'en',
      },
      text,
    },
  }
}

function tap(handoffId: string, userId = 555) {
  return {
    callback_query: {
      id: `q-${userId}`,
      from: {
        id: userId,
        is_bot: false,
        first_name: 'Aziza',
        language_code: 'en',
      },
      message: { message_id: 9, chat: { id: userId, type: 'private' } },
      data: `confirm:${handoffId}`,
    },
  }
}

describe('BotService login', () => {
  it('shows the requesting device and a confirm button for a live handoff', async () => {
    const { auth, bot } = setup()
    const { handoffId } = auth.start({ ip: '203.0.113.1', userAgent: UA })
    const reply = await bot.handle(startMessage(`/start login_${handoffId}`))
    expect(reply).toMatchObject({ method: 'sendMessage', chat_id: 555 })
    expect(JSON.stringify(reply)).toContain('Chrome, Windows')
    expect(JSON.stringify(reply)).toContain(`confirm:${handoffId}`)
  })

  it('tells the user when the link is expired or was never issued', async () => {
    const { bot } = setup()
    const reply = await bot.handle(
      startMessage('/start login_0192f4c0-7a3e-7b11-8c2d-3f4a5b6c7d8e'),
    )
    expect(reply).toMatchObject({
      method: 'sendMessage',
      text: copy.en.expired,
    })
  })

  it('opens the browser session for the account that tapped confirm', async () => {
    const { auth, bot } = setup(['555'])
    const { handoffId, claim } = auth.start({
      ip: '203.0.113.1',
      userAgent: UA,
    })
    expect(auth.claim(claim).status).toBe('waiting')

    const reply = await bot.handle(tap(handoffId))
    expect(reply).toMatchObject({
      method: 'editMessageText',
      text: copy.en.confirmed,
      reply_markup: { inline_keyboard: [] },
    })

    const opened = auth.claim(claim)
    if (opened.status !== 'confirmed') throw new Error(opened.status)
    expect(auth.read(opened.token)).toMatchObject({
      role: 'teacher',
      name: 'Aziza',
    })
  })

  it('lets only the first tap win and tells the second user the link is used', async () => {
    const { auth, bot } = setup()
    const { handoffId, claim } = auth.start({ ip: '203.0.113.1' })
    await bot.handle(tap(handoffId, 111))
    const second = await bot.handle(tap(handoffId, 222))
    expect(second).toMatchObject({
      method: 'editMessageText',
      text: copy.en.expired,
    })
    const opened = auth.claim(claim)
    if (opened.status !== 'confirmed') throw new Error(opened.status)
    const first = auth.start({ ip: '203.0.113.2' })
    await bot.handle(tap(first.handoffId, 111))
    const again = auth.claim(first.claim)
    if (again.status !== 'confirmed') throw new Error(again.status)
    expect(auth.read(opened.token)?.userId).toBe(auth.read(again.token)?.userId)
  })

  it('does not prompt for a handoff that is already confirmed', async () => {
    const { auth, bot } = setup()
    const { handoffId } = auth.start({ ip: '203.0.113.1' })
    await bot.handle(tap(handoffId))
    const reply = await bot.handle(
      startMessage(`/start login_${handoffId}`, 999),
    )
    expect(reply).toMatchObject({ text: copy.en.expired })
  })
})

describe('BotService other updates', () => {
  it('greets on a plain /start', async () => {
    const { bot } = setup()
    expect(await bot.handle(startMessage('/start'))).toEqual({
      method: 'sendMessage',
      chat_id: 555,
      text: copy.en.welcome,
    })
  })

  it('answers anything else with an empty ok', async () => {
    const { bot } = setup()
    expect(await bot.handle({ edited_message: {} })).toEqual({ ok: true })
    expect(await bot.handle('garbage')).toEqual({ ok: true })
  })
})
