import { describe, expect, it } from 'vitest'
import { copy } from './copy'
import {
  confirmResultReply,
  linkExpiredReply,
  loginPromptReply,
  welcomeReply,
} from './replies'
import type { BotLanguage } from './updates'

const id = '0192f4c0-7a3e-7b11-8c2d-3f4a5b6c7d8e'
// 09:05 UTC is 14:05 in Tashkent (UTC+5, no daylight saving).
const context = { device: 'Chrome, Windows', at: Date.UTC(2026, 9, 28, 9, 5) }

describe('loginPromptReply', () => {
  it.each(['uz', 'ru', 'en'] as BotLanguage[])(
    'shows the device and the Tashkent time in %s',
    (language) => {
      const reply = loginPromptReply({
        chatId: 555,
        handoffId: id,
        context,
        language,
      })
      expect(reply).toMatchObject({ method: 'sendMessage', chat_id: 555 })
      expect(reply.text).toContain('Chrome, Windows')
      expect(reply.text).toContain('14:05')
    },
  )

  it('attaches one confirm button that names the handoff', () => {
    const reply = loginPromptReply({
      chatId: 1,
      handoffId: id,
      context,
      language: 'uz',
    })
    expect(reply.reply_markup.inline_keyboard).toEqual([
      [{ text: copy.uz.button, callback_data: `confirm:${id}` }],
    ])
    expect(Buffer.byteLength(`confirm:${id}`)).toBeLessThanOrEqual(64)
  })
})

describe('confirmResultReply', () => {
  const target = { chatId: 555, messageId: 9, callbackQueryId: '8800' }

  it('rewrites the prompt and removes the button', () => {
    expect(confirmResultReply({ ok: true, ...target, language: 'en' })).toEqual(
      {
        method: 'editMessageText',
        chat_id: 555,
        message_id: 9,
        text: copy.en.confirmed,
        reply_markup: { inline_keyboard: [] },
      },
    )
  })

  it('says the link is no longer usable when the handoff was not confirmed', () => {
    expect(
      confirmResultReply({ ok: false, ...target, language: 'ru' }),
    ).toMatchObject({
      method: 'editMessageText',
      text: copy.ru.expired,
    })
  })

  it('answers the tap when the prompt message is not available', () => {
    expect(
      confirmResultReply({ ok: true, callbackQueryId: '8800', language: 'uz' }),
    ).toEqual({
      method: 'answerCallbackQuery',
      callback_query_id: '8800',
      text: copy.uz.confirmed,
      show_alert: true,
    })
  })
})

describe('plain replies', () => {
  it('greets and reports an expired link as messages', () => {
    expect(welcomeReply(7, 'uz')).toEqual({
      method: 'sendMessage',
      chat_id: 7,
      text: copy.uz.welcome,
    })
    expect(linkExpiredReply(7, 'en')).toEqual({
      method: 'sendMessage',
      chat_id: 7,
      text: copy.en.expired,
    })
  })
})

describe('bot copy', () => {
  it('is complete in every language and follows the no-exclamation rule', () => {
    const keys = Object.keys(copy.uz)
    for (const language of ['ru', 'en'] as const) {
      expect(Object.keys(copy[language])).toEqual(keys)
    }
    for (const entry of Object.values(copy)) {
      expect(entry.welcome).not.toContain('!')
      expect(entry.prompt('Chrome', '14:05')).not.toContain('!')
      expect(entry.button).not.toContain('!')
      expect(entry.confirmed).not.toContain('!')
      expect(entry.expired).not.toContain('!')
    }
  })
})
