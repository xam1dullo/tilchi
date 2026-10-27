import type { HandoffContext } from '../auth/auth.service'
import { copy } from './copy'
import { CONFIRM_PREFIX, type BotLanguage } from './updates'

// Replies are returned as the webhook response body, which Telegram executes
// as a Bot API call. No outbound request and no bot token are needed.

const TASHKENT_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function welcomeReply(chatId: number, language: BotLanguage) {
  return {
    method: 'sendMessage' as const,
    chat_id: chatId,
    text: copy[language].welcome,
  }
}

export function linkExpiredReply(chatId: number, language: BotLanguage) {
  return {
    method: 'sendMessage' as const,
    chat_id: chatId,
    text: copy[language].expired,
  }
}

export function loginPromptReply(input: {
  chatId: number
  handoffId: string
  context: HandoffContext
  language: BotLanguage
}) {
  const texts = copy[input.language]
  const time = TASHKENT_CLOCK.format(input.context.at)
  return {
    method: 'sendMessage' as const,
    chat_id: input.chatId,
    text: texts.prompt(input.context.device, time),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: texts.button,
            callback_data: `${CONFIRM_PREFIX}${input.handoffId}`,
          },
        ],
      ],
    },
  }
}

// Editing the prompt removes the button, so a second tap is not possible.
export function confirmResultReply(input: {
  ok: boolean
  callbackQueryId: string
  chatId?: number
  messageId?: number
  language: BotLanguage
}) {
  const texts = copy[input.language]
  const text = input.ok ? texts.confirmed : texts.expired
  if (input.chatId && input.messageId) {
    return {
      method: 'editMessageText' as const,
      chat_id: input.chatId,
      message_id: input.messageId,
      text,
      reply_markup: { inline_keyboard: [] },
    }
  }
  return {
    method: 'answerCallbackQuery' as const,
    callback_query_id: input.callbackQueryId,
    text,
    show_alert: true,
  }
}
