import { normalizeHandoffId } from '../auth/auth.service'
import type { Lang } from './copy'
import { classifyStartPayload, type Level } from './start-payload'

export const CONFIRM_PREFIX = 'confirm:'
export const CONSENT_DATA = 'consent:yes'

type TgUser = {
  id?: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  language_code?: string
}

export type TelegramUpdate = {
  message?: {
    text?: string
    from?: TgUser
    chat?: { id?: number }
    contact?: { phone_number?: string; user_id?: number }
  }
  callback_query?: { id?: string; data?: string; from?: TgUser }
}

type Who = { telegramUserId: string; chatId: number; lang: Lang }

export type BotAction =
  | { type: 'ignore' }
  | ({ type: 'bind_handoff'; handoffId: string; name: string } & Who)
  | {
      type: 'confirm_handoff'
      handoffId: string
      telegramUserId: string
      callbackQueryId: string
    }
  | ({
      type: 'start_registration'
      source: string | null
      level: Level | null
    } & Who)
  | ({ type: 'consent'; callbackQueryId: string } & Who)
  | ({ type: 'answer'; text: string } & Who)
  | ({ type: 'revoke_all' } & Who)

const nameOf = (from: TgUser) =>
  [from.first_name, from.last_name].filter(Boolean).join(' ')

const langOf = (from: TgUser): Lang =>
  from.language_code === 'ru' || from.language_code === 'en'
    ? from.language_code
    : 'uz'

const COMMAND = /^\/([A-Za-z]+)(?:@[A-Za-z0-9_]+)?(?:\s|$)/

export function parseBotUpdate(update: unknown): BotAction {
  if (!update || typeof update !== 'object') return { type: 'ignore' }
  const { message, callback_query: callback } = update as TelegramUpdate

  const data = callback?.data ?? ''
  if (callback?.from?.id && callback.id && !callback.from.is_bot) {
    const from = callback.from
    if (data.startsWith(CONFIRM_PREFIX)) {
      return {
        type: 'confirm_handoff',
        handoffId: normalizeHandoffId(data.slice(CONFIRM_PREFIX.length)),
        telegramUserId: String(from.id),
        callbackQueryId: callback.id,
      }
    }
    if (data === CONSENT_DATA) {
      return {
        type: 'consent',
        callbackQueryId: callback.id,
        telegramUserId: String(from.id),
        chatId: from.id as number,
        lang: langOf(from),
      }
    }
    return { type: 'ignore' }
  }

  const from = message?.from
  if (!from?.id || from.is_bot) return { type: 'ignore' }
  // Private chats only: a command or answer sent in a group is never acted on.
  if (message?.chat?.id !== undefined && message.chat.id !== from.id) {
    return { type: 'ignore' }
  }
  const who: Who = {
    telegramUserId: String(from.id),
    chatId: from.id,
    lang: langOf(from),
  }

  const contact = message?.contact
  if (contact) {
    // Only the sender's own contact card counts, never a forwarded one.
    return contact.user_id === from.id && contact.phone_number
      ? { type: 'answer', text: contact.phone_number, ...who }
      : { type: 'ignore' }
  }

  const text = message?.text?.trim() ?? ''
  const command = COMMAND.exec(text)
  if (!command) {
    // Slash lookalikes such as `/start<id>` are never an answer.
    return text && !text.startsWith('/')
      ? { type: 'answer', text, ...who }
      : { type: 'ignore' }
  }

  const name = command[1]?.toLowerCase()
  if (name === 'revoke' || name === 'chiqish') {
    return { type: 'revoke_all', ...who }
  }
  if (name !== 'start') return { type: 'ignore' }

  const payload = text.slice(command[0].length).trim().split(/\s+/)[0] ?? ''
  const route = classifyStartPayload(payload)
  if (route.kind === 'handoff') {
    return {
      type: 'bind_handoff',
      handoffId: normalizeHandoffId(route.raw),
      name: nameOf(from),
      ...who,
    }
  }
  return {
    type: 'start_registration',
    source: route.source,
    level: route.level,
    ...who,
  }
}
