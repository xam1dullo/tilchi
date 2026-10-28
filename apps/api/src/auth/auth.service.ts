import { HttpException, Inject, Injectable } from '@nestjs/common'
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
import { KV, type Kv } from '../redis/kv'
import { verifyInitData } from './init-data'
import { SessionsRepository } from '../users/sessions.repository'
import {
  DeletedUserError,
  type User,
  UsersRepository,
} from '../users/users.repository'

/** What the Redis cache holds for five minutes: enough to answer a read. */
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
  constructor(
    @Inject(KV) private readonly kv: Kv,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SessionsRepository) private readonly sessions: SessionsRepository,
  ) {}

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
    const user = await this.signInTelegram(claim.telegramUserId, claim.name)
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
    const user = await this.signInTelegram(
      verified.telegramUserId,
      verified.name,
    )
    return this.openSession(user, now)
  }

  private async signInTelegram(telegramUserId: string, name?: string | null) {
    try {
      return await this.users.upsertTelegram(telegramUserId, name)
    } catch (error) {
      if (error instanceof DeletedUserError) {
        throw new HttpException({ error: 'account_deleted' }, 403)
      }
      throw error
    }
  }

  /** Soft-deletes the user, then ends every session they have, on every instance. */
  async deleteUser(userId: string, now = Date.now()) {
    await this.users.softDelete(userId, new Date(now))
    const hashes = await this.sessions.revokeAllForUser(userId, new Date(now))
    await Promise.all(hashes.map((secretHash) => this.forget(secretHash)))
  }

  private async hit(key: string, limit: number, scope: 'ip' | 'telegram') {
    const hits = await this.kv.incr(key, RATE_WINDOW_MS / 1000)
    if (hits > limit) {
      throw new HttpException({ error: 'rate_limited', scope }, 429)
    }
  }

  /** Postgres is the truth; the cache is only filled after the row exists. */
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
    await this.sessions.insert({
      userId: user.id,
      tokenHash: secretHash,
      now: new Date(now),
      idleExpiresAt: new Date(record.expiresAt),
      absoluteExpiresAt: new Date(record.absoluteExpiresAt),
    })
    await this.cacheSession(secretHash, record)
    return { token, maxAgeSeconds: SESSION_TTL_MS / 1000, user, secretHash }
  }

  /**
   * A warm read is answered from Redis. A cold one asks Postgres, which also
   * slides the idle expiry, and refills the cache. So sliding is not exact to
   * the request: it lands at most once per cache lifetime.
   */
  async read(token: string | undefined, now = Date.now()) {
    if (!token) return null
    const secretHash = hash(token)
    const cached = await this.cachedSession(secretHash, now)
    if (cached) return actorOf(cached)
    const live = await this.sessions.touch(
      secretHash,
      new Date(now),
      SESSION_TTL_MS,
    )
    if (!live) return null
    const user = await this.users.get(live.userId)
    if (!user) return null
    const record: SessionRecord = {
      userId: user.id,
      role: user.role,
      name: user.name,
      expiresAt: live.expiresAt.getTime(),
      absoluteExpiresAt: live.absoluteExpiresAt.getTime(),
    }
    await this.cacheSession(secretHash, record)
    // A logout may have landed between the read above and this write.
    if (await this.kv.get(revokedKey(secretHash))) {
      await this.kv.del(sessionCacheKey(secretHash))
      return null
    }
    return actorOf(record)
  }

  /** Ends this one session. Revoke first, then forget the cached copy. */
  async logout(token: string | undefined, now = Date.now()) {
    if (!token) return
    const secretHash = hash(token)
    await this.sessions.revoke(secretHash, new Date(now))
    await this.forget(secretHash)
  }

  /**
   * Marker first, then the cache: a cold read that is mid-flight re-checks the
   * marker after it caches, so it can never leave a revoked session cached.
   * The marker outlives the cache entry it guards.
   */
  private async forget(secretHash: string) {
    await this.kv.set(
      revokedKey(secretHash),
      '1',
      SESSION_CACHE_TTL_SECONDS * 2,
    )
    await this.kv.del(sessionCacheKey(secretHash))
  }

  private cacheSession(secretHash: string, record: SessionRecord) {
    return this.kv.set(
      sessionCacheKey(secretHash),
      JSON.stringify(record),
      SESSION_CACHE_TTL_SECONDS,
    )
  }

  private async cachedSession(secretHash: string, now: number) {
    const [raw, revoked] = await Promise.all([
      this.kv.get(sessionCacheKey(secretHash)),
      this.kv.get(revokedKey(secretHash)),
    ])
    if (!raw || revoked) return null
    const record = JSON.parse(raw) as SessionRecord
    const live = record.expiresAt > now && record.absoluteExpiresAt > now
    return live ? record : null
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

function sessionCacheKey(secretHash: string) {
  return `session:cache:${secretHash}`
}

function revokedKey(secretHash: string) {
  return `session:revoked:${secretHash}`
}

function actorOf(record: SessionRecord) {
  return { userId: record.userId, role: record.role, name: record.name }
}
