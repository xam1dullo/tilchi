import { describe, expect, it } from 'vitest'
import { confirmAnswer, confirmPrompt, expiredNotice } from './replies'
import { parseBotUpdate } from './updates'

const hex = '01a17ecc6cf37882b3be7d39ce083092'
const dashed = '01a17ecc-6cf3-7882-b3be-7d39ce083092'

describe('parseBotUpdate', () => {
  it('ignores command lookalikes and handoffs sent in group chats', () => {
    for (const text of [`/starter ${hex}`, `/start${hex}`]) {
      expect(
        parseBotUpdate({
          message: { text, from: { id: 99 }, chat: { id: 99 } },
        }),
      ).toEqual({ type: 'ignore' })
    }
    expect(
      parseBotUpdate({
        message: {
          text: `/start ${hex}`,
          from: { id: 99 },
          chat: { id: -100 },
        },
      }),
    ).toEqual({ type: 'ignore' })
  })

  it('accepts a bot-addressed start command in a private chat', () => {
    expect(
      parseBotUpdate({
        message: {
          text: `/start@tilchiuz_bot ${hex}`,
          from: { id: 99 },
          chat: { id: 99 },
        },
      }),
    ).toMatchObject({ type: 'bind_handoff', handoffId: dashed })
  })
  it('binds a /start handoff payload to the telegram user', () => {
    const action = parseBotUpdate({
      message: {
        text: `/start ${hex}`,
        from: { id: 99, first_name: 'Ada' },
        chat: { id: 99 },
      },
    })
    expect(action).toEqual({
      type: 'bind_handoff',
      handoffId: dashed,
      telegramUserId: '99',
      name: 'Ada',
      chatId: 99,
      lang: 'uz',
    })
  })

  it('reads the confirm tap and takes the user from the callback sender', () => {
    const action = parseBotUpdate({
      callback_query: { id: 'cb1', data: `confirm:${hex}`, from: { id: 99 } },
    })
    expect(action).toEqual({
      type: 'confirm_handoff',
      handoffId: dashed,
      telegramUserId: '99',
      callbackQueryId: 'cb1',
    })
  })

  it('ignores unrelated updates and bots', () => {
    const ignore = { type: 'ignore' }
    expect(
      parseBotUpdate({ message: { text: '/help', from: { id: 1 } } }),
    ).toEqual(ignore)
    expect(
      parseBotUpdate({
        message: { text: `/start ${hex}`, from: { id: 1, is_bot: true } },
      }),
    ).toEqual(ignore)
    expect(
      parseBotUpdate({
        callback_query: { id: 'x', data: 'other:1', from: { id: 1 } },
      }),
    ).toEqual(ignore)
    expect(parseBotUpdate(null)).toEqual(ignore)
  })
})

describe('bot replies', () => {
  it('asks for a confirm tap that carries the handoff and the request context', () => {
    const reply = confirmPrompt({
      chatId: 5,
      handoffId: dashed,
      context: '1.2.3.4 / UA',
    })
    expect(reply.method).toBe('sendMessage')
    expect(reply.text).toContain('1.2.3.4 / UA')
    expect(reply.reply_markup.inline_keyboard[0][0].callback_data).toBe(
      `confirm:${hex}`,
    )
    expect(
      new TextEncoder().encode(`confirm:${hex}`).length,
    ).toBeLessThanOrEqual(64)
  })

  it('answers the tap and notices expired links', () => {
    expect(confirmAnswer('cb', true).text).toContain('Tasdiqlandi')
    expect(confirmAnswer('cb', false).text).toContain('sizniki emas')
    expect(expiredNotice(5).chat_id).toBe(5)
  })
})

const private99 = { from: { id: 99, language_code: 'ru' }, chat: { id: 99 } }

describe('parseBotUpdate routing', () => {
  it('routes a bare and a site-lead /start to registration', () => {
    expect(
      parseBotUpdate({ message: { text: '/start', ...private99 } }),
    ).toEqual({
      type: 'start_registration',
      source: null,
      level: null,
      telegramUserId: '99',
      chatId: 99,
      lang: 'ru',
    })
    expect(
      parseBotUpdate({ message: { text: '/start ielts_orta', ...private99 } }),
    ).toMatchObject({
      type: 'start_registration',
      source: 'ielts_orta',
      level: 'orta',
    })
    expect(
      parseBotUpdate({ message: { text: '/start whatever', ...private99 } }),
    ).toMatchObject({ type: 'start_registration', source: null })
  })

  it('keeps registration and revoke private-chat only', () => {
    const group = { from: { id: 99 }, chat: { id: -5 } }
    for (const text of ['/start', '/start ielts_orta', '/revoke', 'hello']) {
      expect(parseBotUpdate({ message: { text, ...group } })).toEqual({
        type: 'ignore',
      })
    }
  })

  it('routes revoke commands, plain text and consent taps', () => {
    for (const text of ['/revoke', '/chiqish', '/revoke@tilchiuz_bot']) {
      expect(parseBotUpdate({ message: { text, ...private99 } }).type).toBe(
        'revoke_all',
      )
    }
    expect(
      parseBotUpdate({ message: { text: ' Ada ', ...private99 } }),
    ).toMatchObject({ type: 'answer', text: 'Ada' })
    expect(
      parseBotUpdate({
        callback_query: { id: 'c', data: 'consent:yes', from: { id: 99 } },
      }),
    ).toMatchObject({ type: 'consent', chatId: 99, lang: 'uz' })
  })

  it('never treats a slash lookalike as an answer', () => {
    expect(
      parseBotUpdate({ message: { text: `/start${hex}`, ...private99 } }),
    ).toEqual({ type: 'ignore' })
  })

  it('takes a contact only when it is the sender own', () => {
    const own = { phone_number: '+998901234567', user_id: 99 }
    expect(
      parseBotUpdate({ message: { contact: own, ...private99 } }),
    ).toMatchObject({ type: 'answer', text: '+998901234567' })
    expect(
      parseBotUpdate({
        message: { contact: { ...own, user_id: 5 }, ...private99 },
      }),
    ).toEqual({ type: 'ignore' })
  })
})
