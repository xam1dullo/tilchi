import { HttpException, Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import {
  type Handoff,
  bindTelegramUser,
  claimHandoff,
  confirmByTelegramUser,
  newHandoff,
} from './handoff'
import {
  AUTH_MINIAPP_IP_LIMIT,
  AUTH_START_IP_LIMIT,
  AUTH_START_TELEGRAM_LIMIT,
  HANDOFF_TTL_MS,
  HANDOFF_WRITE_ATTEMPTS,
  RATE_WINDOW_MS,
  SESSION_CACHE_TTL_SECONDS,
  SESSION_TTL_MS,
  type Role,
} from './policy'
import { uuidv7 } from '../id'
import { createKvFromEnv, type Kv } from '../redis/kv'
import { verifyInitData } from './init-data'
import { type User, UserStore } from '../users/user-store'

type SessionRecord = {
  userId: string
  role: Role
  name: string | null
  expiresAt: number
  absoluteExpiresAt: number
}

const SESSION_ABSOLUTE_TTL_MS = 90 * 24 * 60 * 60 * 1000

@Injectable()
export class AuthService {
  private readonly kv: Kv
  private readonly users: UserStore

  constructor() {
    this.kv = createKvFromEnv()
    this.users = new UserStore()
  }

  static forTest(kv: Kv, users = new UserStore()) {
    const service = new AuthService()
    const mutable = service as unknown as { kv: Kv; users: UserStore }
    mutable.kv = kv
    mutable.users = users
    return service
  }

  async start(input: { ip: string; context: string; telegramKey?: string }) {
    await this.hit(`rate:ip:${input.ip}`, AUTH_START_IP_LIMIT, 'ip')
    if (input.telegramKey) {
      await this.hit(
        `rate:tg:${input.telegramKey}`,
        AUTH_START_TELEGRAM_LIMIT,
        'telegram',
      )
    }
    const bindingSecret = randomBytes(32).toString('base64url')
    const handoff = newHandoff({
      id: uuidv7(),
      secret: bindingSecret,
      context: input.context,
      now: Date.now(),
    })
    await this.kv.set(
      this.handoffKey(handoff.id),
      JSON.stringify(handoff),
      HANDOFF_TTL_MS / 1000,
    )
    return {
      handoffId: handoff.id,
      bindingSecret,
      expiresInSeconds: HANDOFF_TTL_MS / 1000,
      deepLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME ?? 'tilchiuz_bot'}?start=${handoff.id.replace(/-/g, '')}`,
    }
  }

  /**
   * Bot saw `/start <handoffId>`. The first Telegram user binds the handoff;
   * anyone else, or an expired handoff, gets null. Returns where the request
   * came from so that user can refuse a handoff they did not start.
   */
  async bindTelegram(
    handoffId: string,
    telegramUserId: string,
    name?: string | null,
    now = Date.now(),
  ) {
    const next = await this.updateHandoff(handoffId, (handoff) =>
      bindTelegramUser(handoff, { telegramUserId, name: name ?? null }, now),
    )
    return next ? { context: next.context } : null
  }

  /** Bot saw the confirm tap. Only the bound Telegram user may confirm. */
  async confirmTelegram(
    handoffId: string,
    telegramUserId: string,
    now = Date.now(),
  ) {
    const next = await this.updateHandoff(handoffId, (handoff) =>
      confirmByTelegramUser(handoff, telegramUserId, now),
    )
    return next !== null
  }

  /**
   * Browser claim. Mints a session for the confirmed Telegram user, once, and
   * only for the browser that started the handoff.
   */
  async confirm(
    handoffId: string,
    browserSecret: string | undefined,
    now = Date.now(),
  ) {
    const handoff = await this.readHandoff(handoffId)
    if (!handoff) throw new HttpException({ error: 'handoff_expired' }, 410)
    const claim = claimHandoff(handoff, browserSecret, now)
    if (claim.kind === 'expired') {
      await this.kv.del(this.handoffKey(handoffId))
      throw new HttpException({ error: 'handoff_expired' }, 410)
    }
    if (claim.kind === 'wrong_browser') {
      throw new HttpException({ error: 'wrong_browser' }, 403)
    }
    if (claim.kind === 'waiting') {
      throw new HttpException({ status: 'waiting' }, 409)
    }
    if (!(await this.kv.take(this.handoffKey(handoff.id)))) {
      throw new HttpException({ error: 'handoff_expired' }, 410)
    }
    const user = this.users.upsertTelegram(claim.telegramUserId, claim.name)
    return this.openSession(user, now)
  }

  /**
   * Mini App initData: the same session, proven by the bot token HMAC. Every
   * attempt counts against the ip first, so a flood of payloads, forged or
   * replayed, is cut off before any verification or session write.
   */
  async miniApp(input: { initData: string; ip: string }, now = Date.now()) {
    await this.hit(`rate:miniapp:ip:${input.ip}`, AUTH_MINIAPP_IP_LIMIT, 'ip')
    const verified = verifyInitData(
      input.initData,
      process.env.TELEGRAM_BOT_TOKEN ?? '',
      Math.floor(now / 1000),
    )
    if (!verified) throw new HttpException({ error: 'invalid_init_data' }, 401)
    const user = this.users.upsertTelegram(
      verified.telegramUserId,
      verified.name,
    )
    return this.openSession(user, now)
  }

  private async hit(key: string, limit: number, scope: 'ip' | 'telegram') {
    const hits = await this.kv.incr(key, RATE_WINDOW_MS / 1000)
    if (hits > limit) {
      throw new HttpException({ error: 'rate_limited', scope }, 429)
    }
  }

  private async openSession(user: User, now: number) {
    const token = randomBytes(32).toString('base64url')
    const secretHash = hash(token)
    const record: SessionRecord = {
      userId: user.id,
      role: user.role,
      name: user.name,
      expiresAt: now + SESSION_TTL_MS,
      absoluteExpiresAt: now + SESSION_ABSOLUTE_TTL_MS,
    }
    await this.kv.set(
      `session:cache:${secretHash}`,
      JSON.stringify(record),
      SESSION_CACHE_TTL_SECONDS,
    )
    await this.kv.set(
      `session:${secretHash}`,
      JSON.stringify(record),
      SESSION_TTL_MS / 1000,
    )
    return { token, maxAgeSeconds: SESSION_TTL_MS / 1000, user, secretHash }
  }

  async read(token: string | undefined, now = Date.now()) {
    if (!token) return null
    const secretHash = hash(token)
    const cached = await this.kv.get(`session:cache:${secretHash}`)
    const raw = cached ?? (await this.kv.get(`session:${secretHash}`))
    if (!raw) return null
    const session = JSON.parse(raw) as SessionRecord
    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      await this.logout(token)
      return null
    }
    session.expiresAt = Math.min(
      now + SESSION_TTL_MS,
      session.absoluteExpiresAt,
    )
    const ttl = Math.max(1, Math.ceil((session.expiresAt - now) / 1000))
    await this.kv.set(
      `session:cache:${secretHash}`,
      JSON.stringify(session),
      SESSION_CACHE_TTL_SECONDS,
    )
    await this.kv.set(`session:${secretHash}`, JSON.stringify(session), ttl)
    return { userId: session.userId, role: session.role, name: session.name }
  }

  async logout(token: string | undefined) {
    if (!token) return
    const secretHash = hash(token)
    await this.kv.del(`session:cache:${secretHash}`)
    await this.kv.del(`session:${secretHash}`)
  }

  userStore() {
    return this.users
  }

  private async readHandoff(id: string) {
    const raw = await this.kv.get(this.handoffKey(id))
    if (!raw) return null
    return JSON.parse(raw) as Handoff
  }

  /**
   * Change a handoff without being able to undo anyone else's write. The swap
   * only lands while the record is still the one the change was computed from.
   * If it moved, the change is recomputed from the new record; if it is gone
   * (consumed by `confirm`, or expired) nothing is written, so a late bind or
   * confirm tap cannot bring a consumed handoff back. Running out of attempts
   * refuses the request instead of writing anyway.
   */
  private async updateHandoff(
    id: string,
    change: (handoff: Handoff) => Handoff | null,
  ) {
    const key = this.handoffKey(id)
    for (let attempt = 0; attempt < HANDOFF_WRITE_ATTEMPTS; attempt += 1) {
      const raw = await this.kv.get(key)
      if (!raw) return null
      const next = change(JSON.parse(raw) as Handoff)
      if (!next) return null
      if (await this.kv.cas(key, raw, JSON.stringify(next))) return next
    }
    return null
  }

  private handoffKey(id: string) {
    return `handoff:${normalizeHandoffId(id)}`
  }
}

export function normalizeHandoffId(value: string) {
  const compact = value.replace(/[^a-fA-F0-9]/g, '').toLowerCase()
  if (compact.length === 32) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
  }
  return value
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
