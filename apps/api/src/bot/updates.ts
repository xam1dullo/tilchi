import { normalizeHandoffId } from '../auth/auth.service'

export type TelegramUpdate = {
  message?: {
    text?: string
    from?: { id?: number; first_name?: string; last_name?: string }
  }
}

export type BotAction =
  | { type: 'ignore' }
  | {
      type: 'bind_handoff'
      handoffId: string
      telegramUserId: string
      name: string
    }

export function parseBotUpdate(update: unknown): BotAction {
  if (!update || typeof update !== 'object') return { type: 'ignore' }
  const message = (update as TelegramUpdate).message
  const text = message?.text?.trim() ?? ''
  const from = message?.from
  if (!text.startsWith('/start') || !from?.id) return { type: 'ignore' }
  const payload = text.slice('/start'.length).trim().split(/\s+/)[0] ?? ''
  if (!payload) return { type: 'ignore' }
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
  return {
    type: 'bind_handoff',
    handoffId: normalizeHandoffId(payload),
    telegramUserId: String(from.id),
    name,
  }
}
