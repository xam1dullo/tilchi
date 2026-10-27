import { describe, expect, it } from 'vitest'
import { parseBotUpdate } from './updates'

const id = '0192f4c0-7a3e-7b11-8c2d-3f4a5b6c7d8e'

function message(text: unknown, patch: Record<string, unknown> = {}) {
  return {
    update_id: 1,
    message: {
      message_id: 7,
      date: 1,
      chat: { id: 555, type: 'private' },
      from: {
        id: 555,
        is_bot: false,
        first_name: 'Aziza',
        language_code: 'ru',
      },
      text,
      ...patch,
    },
  }
}

function callback(data: unknown, patch: Record<string, unknown> = {}) {
  return {
    update_id: 2,
    callback_query: {
      id: '8800',
      from: {
        id: 555,
        is_bot: false,
        first_name: 'Aziza',
        last_name: 'Karimova',
        language_code: 'uz',
      },
      message: { message_id: 9, chat: { id: 555, type: 'private' } },
      data,
      ...patch,
    },
  }
}

describe('parseBotUpdate: /start', () => {
  it('turns a login deep link into a prompt request', () => {
    expect(parseBotUpdate(message(`/start login_${id}`))).toEqual({
      kind: 'login_prompt',
      chatId: 555,
      handoffId: id,
      language: 'ru',
    })
  })

  it('accepts the /start@bot form', () => {
    expect(
      parseBotUpdate(message(`/start@tilchiuz_bot login_${id}`)),
    ).toMatchObject({
      kind: 'login_prompt',
      handoffId: id,
    })
  })

  it('greets on a bare /start and on funnel or malformed payloads', () => {
    for (const text of ['/start', '/start ielts_orta', '/start login_zzz']) {
      expect(parseBotUpdate(message(text))).toEqual({
        kind: 'welcome',
        chatId: 555,
        language: 'ru',
      })
    }
  })

  it('ignores other text, groups, bots and oversized text', () => {
    expect(parseBotUpdate(message('hello'))).toEqual({ kind: 'ignore' })
    expect(parseBotUpdate(message('/startup'))).toEqual({ kind: 'ignore' })
    expect(
      parseBotUpdate(
        message(`/start login_${id}`, { chat: { id: -9, type: 'group' } }),
      ),
    ).toEqual({ kind: 'ignore' })
    expect(
      parseBotUpdate(
        message(`/start login_${id}`, { from: { id: 5, is_bot: true } }),
      ),
    ).toEqual({ kind: 'ignore' })
    expect(parseBotUpdate(message(`/start ${'x'.repeat(5000)}`))).toEqual({
      kind: 'ignore',
    })
  })
})

describe('parseBotUpdate: confirm button', () => {
  it('identifies who tapped, from the callback sender', () => {
    expect(parseBotUpdate(callback(`confirm:${id}`))).toEqual({
      kind: 'login_confirm',
      handoffId: id,
      callbackQueryId: '8800',
      chatId: 555,
      messageId: 9,
      account: { id: '555', name: 'Aziza Karimova' },
      language: 'uz',
    })
  })

  it('still confirms when the prompt message is no longer available', () => {
    const action = parseBotUpdate(
      callback(`confirm:${id}`, { message: undefined }),
    )
    expect(action).toMatchObject({ kind: 'login_confirm', handoffId: id })
    expect(action).not.toHaveProperty('messageId', 9)
  })

  it('ignores unknown or malformed callback data', () => {
    for (const data of [
      'other',
      'confirm:',
      'confirm:../x',
      `confirm:${id}x`,
      5,
      undefined,
    ]) {
      expect(parseBotUpdate(callback(data))).toEqual({ kind: 'ignore' })
    }
  })

  it('ignores a callback from a bot or without a usable sender id', () => {
    for (const from of [
      { id: 5, is_bot: true },
      { id: '555', is_bot: false },
      { id: 0, is_bot: false },
      { id: -4, is_bot: false },
      { id: 1.5, is_bot: false },
      null,
    ]) {
      expect(parseBotUpdate(callback(`confirm:${id}`, { from }))).toEqual({
        kind: 'ignore',
      })
    }
  })
})

describe('parseBotUpdate: untrusted input', () => {
  it('ignores anything that is not a plain update object', () => {
    for (const body of [
      null,
      undefined,
      'x',
      5,
      [],
      {},
      { message: 5 },
      { callback_query: [] },
    ]) {
      expect(parseBotUpdate(body)).toEqual({ kind: 'ignore' })
    }
  })

  it('maps the telegram language to a supported one, defaulting to uz', () => {
    const lang = (code: unknown) =>
      parseBotUpdate(
        message('/start', {
          from: { id: 1, is_bot: false, language_code: code },
        }),
      )
    expect(lang('ru-RU')).toMatchObject({ language: 'ru' })
    expect(lang('en')).toMatchObject({ language: 'en' })
    expect(lang('uz')).toMatchObject({ language: 'uz' })
    expect(lang('de')).toMatchObject({ language: 'uz' })
    expect(lang(undefined)).toMatchObject({ language: 'uz' })
  })

  it('omits the account name when the profile has none and trims long ones', () => {
    const plain = parseBotUpdate(
      callback(`confirm:${id}`, { from: { id: 5, is_bot: false } }),
    )
    expect(plain).toMatchObject({ account: { id: '5' } })
    expect(
      (plain as { account: { name?: string } }).account.name,
    ).toBeUndefined()
    const long = parseBotUpdate(
      callback(`confirm:${id}`, {
        from: { id: 5, is_bot: false, first_name: 'x'.repeat(300) },
      }),
    )
    expect((long as { account: { name: string } }).account.name).toHaveLength(
      100,
    )
  })
})
