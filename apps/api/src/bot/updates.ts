import type { TelegramAccount } from '../auth/auth.service'
import { isHandoffId, parseLoginPayload } from './login-link'

export type BotLanguage = 'uz' | 'ru' | 'en'

export type BotAction =
  | { kind: 'ignore' }
  | { kind: 'welcome'; chatId: number; language: BotLanguage }
  | {
      kind: 'login_prompt'
      chatId: number
      handoffId: string
      language: BotLanguage
    }
  | {
      kind: 'login_confirm'
      handoffId: string
      callbackQueryId: string
      chatId?: number
      messageId?: number
      account: TelegramAccount
      language: BotLanguage
    }

export const CONFIRM_PREFIX = 'confirm:'

const IGNORE: BotAction = { kind: 'ignore' }
const NAME_MAX = 100
// "/start", "/start payload" or "/start@bot payload"; a real command is short.
const START = /^\/start(?:@[A-Za-z0-9_]{1,32})?(?:[ \t]+(\S+))?\s*$/
const TEXT_MAX = 200

type Json = Record<string, unknown>

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const positiveInt = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined

function language(code: unknown): BotLanguage {
  const prefix = typeof code === 'string' ? code.slice(0, 2).toLowerCase() : ''
  return prefix === 'ru' || prefix === 'en' ? prefix : 'uz'
}

function displayName(from: Json) {
  const name = [from.first_name, from.last_name]
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, NAME_MAX)
  return name || undefined
}

// The person who sent the message or pressed the button, never a chat id.
function sender(value: unknown) {
  if (!isRecord(value) || value.is_bot === true) return undefined
  const id = positiveInt(value.id)
  if (!id) return undefined
  const name = displayName(value)
  return {
    account: name ? { id: String(id), name } : { id: String(id) },
    language: language(value.language_code),
  }
}

function fromMessage(message: Json): BotAction {
  const from = sender(message.from)
  const chat = isRecord(message.chat) ? message.chat : undefined
  const chatId = positiveInt(chat?.id)
  const text = typeof message.text === 'string' ? message.text : ''
  if (!from || !chatId || chat?.type !== 'private') return IGNORE
  if (text.length > TEXT_MAX) return IGNORE
  const start = START.exec(text)
  if (!start) return IGNORE
  const handoffId = parseLoginPayload(start[1] ?? '')
  return handoffId
    ? { kind: 'login_prompt', chatId, handoffId, language: from.language }
    : { kind: 'welcome', chatId, language: from.language }
}

function fromCallback(query: Json): BotAction {
  const from = sender(query.from)
  const data = typeof query.data === 'string' ? query.data : ''
  const callbackQueryId = typeof query.id === 'string' ? query.id : ''
  if (!from || !callbackQueryId || !data.startsWith(CONFIRM_PREFIX)) {
    return IGNORE
  }
  const handoffId = data.slice(CONFIRM_PREFIX.length)
  if (!isHandoffId(handoffId)) return IGNORE
  const message = isRecord(query.message) ? query.message : undefined
  const chat = isRecord(message?.chat) ? message.chat : undefined
  return {
    kind: 'login_confirm',
    handoffId,
    callbackQueryId,
    chatId: positiveInt(chat?.id),
    messageId: positiveInt(message?.message_id),
    account: from.account,
    language: from.language,
  }
}

// Telegram posts untrusted JSON; every field is checked before it is used.
export function parseBotUpdate(body: unknown): BotAction {
  if (!isRecord(body)) return IGNORE
  if (isRecord(body.message)) return fromMessage(body.message)
  if (isRecord(body.callback_query)) return fromCallback(body.callback_query)
  return IGNORE
}
