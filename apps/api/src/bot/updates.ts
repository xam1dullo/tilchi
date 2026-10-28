import { normalizeHandoffId } from '../auth/auth.service'

export const CONFIRM_PREFIX = 'confirm:'

type TgUser = {
  id?: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
}

export type TelegramUpdate = {
  message?: { text?: string; from?: TgUser; chat?: { id?: number } }
  callback_query?: { id?: string; data?: string; from?: TgUser }
}

export type BotAction =
  | { type: 'ignore' }
  | {
      type: 'bind_handoff'
      handoffId: string
      telegramUserId: string
      name: string
      chatId: number
    }
  | {
      type: 'confirm_handoff'
      handoffId: string
      telegramUserId: string
      callbackQueryId: string
    }

const nameOf = (from: TgUser) =>
  [from.first_name, from.last_name].filter(Boolean).join(' ')

export function parseBotUpdate(update: unknown): BotAction {
  if (!update || typeof update !== 'object') return { type: 'ignore' }
  const { message, callback_query: callback } = update as TelegramUpdate

  const data = callback?.data ?? ''
  if (callback?.from?.id && callback.id && data.startsWith(CONFIRM_PREFIX)) {
    if (callback.from.is_bot) return { type: 'ignore' }
    return {
      type: 'confirm_handoff',
      handoffId: normalizeHandoffId(data.slice(CONFIRM_PREFIX.length)),
      telegramUserId: String(callback.from.id),
      callbackQueryId: callback.id,
    }
  }

  const text = message?.text?.trim() ?? ''
  const from = message?.from
  if (!text.startsWith('/start') || !from?.id || from.is_bot) {
    return { type: 'ignore' }
  }
  const payload = text.slice('/start'.length).trim().split(/\s+/)[0] ?? ''
  if (!payload) return { type: 'ignore' }
  return {
    type: 'bind_handoff',
    handoffId: normalizeHandoffId(payload),
    telegramUserId: String(from.id),
    name: nameOf(from),
    chatId: message?.chat?.id ?? from.id,
  }
}
