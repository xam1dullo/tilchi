import { setTimeout as sleep } from 'node:timers/promises'
import { Inject, Injectable } from '@nestjs/common'
import { BotApi, TelegramError } from '../bot/bot-api'

/** Telegram allows about 30 messages a second overall and 1 a second per chat. */
const GLOBAL_GAP_MS = 40
const CHAT_GAP_MS = 1100

/** The bot is cooling down after a 429; nothing is sent until `retryAfter` s pass. */
export class TelegramCooldown extends Error {
  constructor(readonly retryAfter: number) {
    super(`telegram cooldown for ${retryAfter}s`)
  }
}

/**
 * The outbox's Telegram channel: spaces sends to stay under the Bot API rate
 * limits and, after a 429, holds every send (any row, any chat) until the
 * cooldown ends.
 *
 * Single-dispatcher assumption: spacing and cooldown live in this process's
 * memory. v1 runs ONE API instance on one VPS, so there is one dispatcher and
 * no Redis coordination. A second instance would need a shared limiter.
 */
@Injectable()
export class TelegramSender {
  private readonly lastToChat = new Map<string, number>()
  private lastAny = 0
  private blockedUntil = 0

  constructor(@Inject(BotApi) private readonly api: BotApi) {}

  async send(chatId: string, text: string) {
    const cooling = this.blockedUntil - Date.now()
    if (cooling > 0) throw new TelegramCooldown(Math.ceil(cooling / 1000))
    const now = Date.now()
    const wait = Math.max(
      this.lastAny + GLOBAL_GAP_MS - now,
      (this.lastToChat.get(chatId) ?? 0) + CHAT_GAP_MS - now,
      0,
    )
    if (wait > 0) await sleep(wait)
    this.lastAny = Date.now()
    this.lastToChat.set(chatId, this.lastAny)
    try {
      await this.api.deliver(chatId, text)
    } catch (error) {
      if (error instanceof TelegramError && error.retryAfter) {
        this.blockedUntil = Date.now() + error.retryAfter * 1000
      }
      throw error
    }
  }
}
