import { describe, expect, it } from 'vitest'
import { confirmAnswer, confirmPrompt, expiredNotice } from './replies'
import { parseBotUpdate } from './updates'

const hex = '01a17ecc6cf37882b3be7d39ce083092'
const dashed = '01a17ecc-6cf3-7882-b3be-7d39ce083092'

describe('parseBotUpdate', () => {
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

  it('ignores unrelated updates, bots, and a bare /start', () => {
    const ignore = { type: 'ignore' }
    expect(
      parseBotUpdate({ message: { text: 'hi', from: { id: 1 } } }),
    ).toEqual(ignore)
    expect(
      parseBotUpdate({ message: { text: '/start', from: { id: 1 } } }),
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
