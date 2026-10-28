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
  update_id?: number
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
  | ({ type: 'answer'; text: string; updateId?: number } & Who)
  | ({ type: 'revoke_all' } & Who)

const nameOf = (from: TgUser) =>
  [from.first_name, from.last_name].filter(Boolean).join(' ')

const langOf = (from: TgUser): Lang =>
  from.language_code === 'ru' || from.language_code === 'en'
    ? from.language_code
    : 'uz'

const COMMAND = /^\/([A-Za-z]+)(?:@[A-Za-z0-9_]+)?(?:\s|$)/

const IGNORE: BotAction = { type: 'ignore' }

function parseCallback(
  callback: NonNullable<TelegramUpdate['callback_query']>,
): BotAction {
  const { from, id, data = '' } = callback
  if (!from?.id || !id || from.is_bot) return IGNORE
  if (data.startsWith(CONFIRM_PREFIX)) {
    return {
      type: 'confirm_handoff',
      handoffId: normalizeHandoffId(data.slice(CONFIRM_PREFIX.length)),
      telegramUserId: String(from.id),
      callbackQueryId: id,
    }
  }
  if (data !== CONSENT_DATA) return IGNORE
  return {
    type: 'consent',
    callbackQueryId: id,
    telegramUserId: String(from.id),
    chatId: from.id,
    lang: langOf(from),
  }
}

function parseCommand(
  name: string,
  rest: string,
  who: Who,
  from: TgUser,
): BotAction {
  if (name === 'revoke' || name === 'chiqish') {
    return { type: 'revoke_all', ...who }
  }
  if (name !== 'start') return IGNORE
  const route = classifyStartPayload(rest.split(/\s+/)[0] ?? '')
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

function parseText(rawText: string | undefined, who: Who, from: TgUser) {
  const text = rawText?.trim() ?? ''
  const command = COMMAND.exec(text)
  if (command) {
    const rest = text.slice(command[0].length).trim()
    return parseCommand(command[1]?.toLowerCase() ?? '', rest, who, from)
  }
  // Slash lookalikes such as `/start<id>` are never an answer.
  return text && !text.startsWith('/')
    ? ({ type: 'answer', text, ...who } satisfies BotAction)
    : IGNORE
}

// Only the sender's own contact card counts, never a forwarded one.
function parseContact(
  contact: NonNullable<NonNullable<TelegramUpdate['message']>['contact']>,
  who: Who,
  from: TgUser,
): BotAction {
  return contact.user_id === from.id && contact.phone_number
    ? { type: 'answer', text: contact.phone_number, ...who }
    : IGNORE
}

// Private chats only: a command or answer sent in a group is never acted on.
const isPrivate = (chatId: number | undefined, from: TgUser) =>
  chatId === undefined || chatId === from.id

function parseMessage(
  message: NonNullable<TelegramUpdate['message']>,
): BotAction {
  const from = message.from
  if (!from?.id || from.is_bot || !isPrivate(message.chat?.id, from)) {
    return IGNORE
  }
  const who: Who = {
    telegramUserId: String(from.id),
    chatId: from.id,
    lang: langOf(from),
  }
  return message.contact
    ? parseContact(message.contact, who, from)
    : parseText(message.text, who, from)
}

export function parseBotUpdate(update: unknown): BotAction {
  if (!update || typeof update !== 'object') return IGNORE
  const {
    message,
    callback_query: callback,
    update_id,
  } = update as TelegramUpdate
  if (callback) return parseCallback(callback)
  const action = message ? parseMessage(message) : IGNORE
  return action.type === 'answer' && Number.isSafeInteger(update_id)
    ? { ...action, updateId: update_id }
    : action
}
