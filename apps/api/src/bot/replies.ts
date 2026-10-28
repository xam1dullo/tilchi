import { CONFIRM_PREFIX } from './updates'

/**
 * Webhook replies. Telegram runs the method named in the response body, so the
 * bot needs no outbound Bot API call to answer.
 */
export function confirmPrompt(input: {
  chatId: number
  handoffId: string
  context: string
}) {
  return {
    method: 'sendMessage',
    chat_id: input.chatId,
    text: `Tilchi veb-ilovasiga kirishni tasdiqlaysizmi?\n\nSo‘rov: ${input.context}\n\nBu so‘rovni o‘zingiz boshlamagan bo‘lsangiz, tasdiqlamang.`,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Tasdiqlash',
            callback_data: `${CONFIRM_PREFIX}${input.handoffId.replace(/-/g, '')}`,
          },
        ],
      ],
    },
  }
}

export function expiredNotice(chatId: number) {
  return {
    method: 'sendMessage',
    chat_id: chatId,
    text: 'Havola eskirgan yoki boshqa foydalanuvchiga tegishli. Saytdan qaytadan urinib ko‘ring.',
  }
}

export function confirmAnswer(callbackQueryId: string, confirmed: boolean) {
  return {
    method: 'answerCallbackQuery',
    callback_query_id: callbackQueryId,
    text: confirmed
      ? 'Tasdiqlandi. Brauzerga qayting.'
      : 'Havola eskirgan yoki sizniki emas.',
  }
}
