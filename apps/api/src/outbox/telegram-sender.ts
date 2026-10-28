import { setTimeout as sleep } from 'node:timers/promises'
import { Inject, Injectable } from '@nestjs/common'
import { BotApi } from '../bot/bot-api'

/** Telegram allows about 30 messages a second overall and 1 a second per chat. */
const GLOBAL_GAP_MS = 40
const CHAT_GAP_MS = 1100

/**
 * The outbox's Telegram channel: spaces sends to stay under the Bot API rate
 * limits. Errors (including 429 with `retryAfter`) propagate as `TelegramError`.
 */
@Injectable()
export class TelegramSender {
  private readonly lastToChat = new Map<string, number>()
  private lastAny = 0

  constructor(@Inject(BotApi) private readonly api: BotApi) {}

  async send(chatId: string, text: string) {
    const now = Date.now()
    const wait = Math.max(
      this.lastAny + GLOBAL_GAP_MS - now,
      (this.lastToChat.get(chatId) ?? 0) + CHAT_GAP_MS - now,
      0,
    )
    if (wait > 0) await sleep(wait)
    this.lastAny = Date.now()
    this.lastToChat.set(chatId, this.lastAny)
    await this.api.deliver(chatId, text)
  }
}
