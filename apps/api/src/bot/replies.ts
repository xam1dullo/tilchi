import { COPY, type Lang } from './copy'
import type { Field } from './registration'
import { CONFIRM_PREFIX, CONSENT_DATA } from './updates'

/**
 * Webhook replies. Telegram runs the method named in the response body, so the
 * bot needs no outbound Bot API call to answer.
 */
const send = (chatId: number, text: string, replyMarkup?: object) => ({
  method: 'sendMessage',
  chat_id: chatId,
  text,
  ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
})

export function confirmPrompt(input: {
  chatId: number
  handoffId: string
  context: string
  lang?: Lang
}) {
  const copy = COPY[input.lang ?? 'uz']
  return {
    method: 'sendMessage',
    chat_id: input.chatId,
    text: copy.confirmLogin(input.context),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: copy.confirmButton,
            callback_data: `${CONFIRM_PREFIX}${input.handoffId.replace(/-/g, '')}`,
          },
        ],
      ],
    },
  }
}

export const expiredNotice = (chatId: number, lang: Lang = 'uz') =>
  send(chatId, COPY[lang].expired)

export function confirmAnswer(
  callbackQueryId: string,
  confirmed: boolean,
  lang: Lang = 'uz',
) {
  return {
    method: 'answerCallbackQuery',
    callback_query_id: callbackQueryId,
    text: confirmed ? COPY[lang].confirmed : COPY[lang].notYours,
  }
}

export const consentPrompt = (chatId: number, lang: Lang) =>
  send(chatId, COPY[lang].privacy, {
    inline_keyboard: [
      [{ text: COPY[lang].consentButton, callback_data: CONSENT_DATA }],
    ],
  })

export function fieldPrompt(
  chatId: number,
  lang: Lang,
  field: Field,
  retry = false,
) {
  const copy = COPY[lang]
  const text = retry
    ? `${copy.invalid}\n\n${copy.prompts[field]}`
    : copy.prompts[field]
  return send(
    chatId,
    text,
    field === 'phone'
      ? {
          keyboard: [[{ text: copy.shareContact, request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        }
      : { remove_keyboard: true },
  )
}

export const doneNotice = (chatId: number, lang: Lang, appUrl?: string) =>
  send(chatId, COPY[lang].done, openAppMarkup(lang, appUrl))

export const alreadyRegistered = (
  chatId: number,
  lang: Lang,
  appUrl?: string,
) => send(chatId, COPY[lang].alreadyRegistered, openAppMarkup(lang, appUrl))

export const revokedNotice = (chatId: number, lang: Lang, count: number) =>
  send(chatId, COPY[lang].revoked(count), { remove_keyboard: true })

function openAppMarkup(lang: Lang, appUrl?: string) {
  return appUrl
    ? {
        inline_keyboard: [
          [{ text: COPY[lang].openApp, web_app: { url: appUrl } }],
        ],
      }
    : { remove_keyboard: true }
}
