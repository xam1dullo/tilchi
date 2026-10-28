import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'

/** Outbound Telegram Bot API calls (everything else answers in the webhook body). */
@Injectable()
export class BotApi implements OnApplicationBootstrap {
  private readonly log = new Logger(BotApi.name)

  private async call(method: string, body: object) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!response.ok)
      throw new Error(`${method} failed with ${response.status}`)
  }

  /** Never throws: a failed alert must not fail the user's registration. */
  async send(chatId: string, text: string) {
    try {
      await this.call('sendMessage', { chat_id: chatId, text })
    } catch (error) {
      this.log.error(`sendMessage to ${chatId}: ${(error as Error).message}`)
    }
  }

  /** Mini App menu button (G1). Skipped without a public https app url and in tests. */
  async onApplicationBootstrap() {
    const url = publicAppUrl()
    if (process.env.NODE_ENV === 'test' || !url) return
    try {
      await this.call('setChatMenuButton', {
        menu_button: { type: 'web_app', text: 'Tilchi', web_app: { url } },
      })
    } catch (error) {
      this.log.error(`menu button: ${(error as Error).message}`)
    }
  }
}

export function publicAppUrl(env: NodeJS.ProcessEnv = process.env) {
  const value = env.PUBLIC_APP_URL?.trim()
  return value?.startsWith('https://') ? value : undefined
}

/** `ADMIN_CHAT_IDS` (comma list) plus the legacy single `ADMIN_CHAT_ID`, deduplicated. */
export function adminChatIds(env: NodeJS.ProcessEnv = process.env) {
  const ids = `${env.ADMIN_CHAT_IDS ?? ''},${env.ADMIN_CHAT_ID ?? ''}`
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return [...new Set(ids)]
}
