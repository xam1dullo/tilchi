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
  AUTH_START_IP_LIMIT,
  AUTH_START_TELEGRAM_LIMIT,
  HANDOFF_TTL_MS,
  RATE_WINDOW_MS,
  SESSION_CACHE_TTL_SECONDS,
  SESSION_TTL_MS,
  type Role,
} from './policy'
import { uuidv7 } from '../id'
import { createKvFromEnv, type Kv } from '../redis/kv'
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
    const ipHits = await this.kv.incr(
      `rate:ip:${input.ip}`,
      RATE_WINDOW_MS / 1000,
    )
    if (ipHits > AUTH_START_IP_LIMIT) {
      throw new HttpException({ error: 'rate_limited', scope: 'ip' }, 429)
    }
    if (input.telegramKey) {
      const telegramHits = await this.kv.incr(
        `rate:tg:${input.telegramKey}`,
        RATE_WINDOW_MS / 1000,
      )
      if (telegramHits > AUTH_START_TELEGRAM_LIMIT) {
        throw new HttpException(
          { error: 'rate_limited', scope: 'telegram' },
          429,
        )
      }
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
    const handoff = await this.readHandoff(handoffId)
    const next = handoff
      ? bindTelegramUser(handoff, { telegramUserId, name: name ?? null }, now)
      : null
    if (!next) return null
    await this.writeHandoff(next, now)
    return { context: next.context }
  }

  /** Bot saw the confirm tap. Only the bound Telegram user may confirm. */
  async confirmTelegram(
    handoffId: string,
    telegramUserId: string,
    now = Date.now(),
  ) {
    const handoff = await this.readHandoff(handoffId)
    const next = handoff
      ? confirmByTelegramUser(handoff, telegramUserId, now)
      : null
    if (!next) return false
    await this.writeHandoff(next, now)
    return true
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

  private async writeHandoff(handoff: Handoff, now: number) {
    const remaining = Math.max(
      1,
      Math.ceil((HANDOFF_TTL_MS - (now - handoff.createdAt)) / 1000),
    )
    await this.kv.set(
      this.handoffKey(handoff.id),
      JSON.stringify(handoff),
      remaining,
    )
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
