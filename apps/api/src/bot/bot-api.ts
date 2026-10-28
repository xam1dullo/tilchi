import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'

/** Outbound Telegram Bot API calls (everything else answers in the webhook body). */
/** A failed Bot API call; `retryAfter` (seconds) is set when Telegram rate-limits us. */
export class TelegramError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message)
  }

  /** A blocked bot or an unknown chat never succeeds on retry. */
  get permanent() {
    return this.status === 400 || this.status === 403
  }
}

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
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        parameters?: { retry_after?: number }
      } | null
      throw new TelegramError(
        `${method} failed with ${response.status}`,
        response.status,
        body?.parameters?.retry_after,
      )
    }
  }

  /** Throws `TelegramError` on failure; the outbox worker decides about retries. */
  async deliver(chatId: string, text: string) {
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      link_preview_options: { is_disabled: true },
    })
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
