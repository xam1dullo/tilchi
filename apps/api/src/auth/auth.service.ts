import { HttpException, Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import {
  HANDOFF_TTL_MS,
  RATE_WINDOW_MS,
  SESSION_CACHE_TTL_SECONDS,
  SESSION_TTL_MS,
  decideAuthStart,
  type Role,
} from './policy'
import { uuidv7 } from '../id'
import { createKvFromEnv, type Kv } from '../redis/kv'
import { UserStore } from '../users/user-store'

type Hit = { at: number }
type Handoff = { id: string; createdAt: number; telegramUserId?: string }
type SessionRecord = {
  userId: string
  role: Role
  name: string | null
  expiresAt: number
}

@Injectable()
export class AuthService {
  private readonly ipHits = new Map<string, Hit[]>()
  private readonly telegramHits = new Map<string, Hit[]>()
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

  start(input: { ip: string; telegramKey?: string; now?: number }) {
    const now = input.now ?? Date.now()
    const ipHits = this.prune(this.ipHits, input.ip, now)
    const telegramHits = input.telegramKey
      ? this.prune(this.telegramHits, input.telegramKey, now)
      : 0
    const decision = decideAuthStart({ ipHits, telegramHits })
    if (decision !== 'allow') {
      throw new HttpException({ error: 'rate_limited', scope: decision }, 429)
    }
    this.touch(this.ipHits, input.ip, now)
    if (input.telegramKey) this.touch(this.telegramHits, input.telegramKey, now)
    const handoff: Handoff = { id: uuidv7(), createdAt: now }
    void this.kv.set(
      this.handoffKey(handoff.id),
      JSON.stringify(handoff),
      HANDOFF_TTL_MS / 1000,
    )
    return {
      handoffId: handoff.id,
      expiresInSeconds: HANDOFF_TTL_MS / 1000,
      deepLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME ?? 'tilchiuz_bot'}?start=${handoff.id.replace(/-/g, '')}`,
    }
  }

  async bindTelegram(
    handoffId: string,
    telegramUserId: string,
    name?: string | null,
  ) {
    const handoff = await this.readHandoff(handoffId)
    if (!handoff) throw new HttpException({ error: 'handoff_expired' }, 410)
    handoff.telegramUserId = telegramUserId
    const remaining = Math.max(
      1,
      Math.ceil((HANDOFF_TTL_MS - (Date.now() - handoff.createdAt)) / 1000),
    )
    await this.kv.set(
      this.handoffKey(handoff.id),
      JSON.stringify(handoff),
      remaining,
    )
    this.users.upsertTelegram(telegramUserId, name)
    return { ok: true as const, handoffId: handoff.id }
  }

  async confirm(handoffId: string, now = Date.now()) {
    const handoff = await this.readHandoff(handoffId)
    if (!handoff || now - handoff.createdAt > HANDOFF_TTL_MS) {
      await this.kv.del(this.handoffKey(handoffId))
      throw new HttpException({ error: 'handoff_expired' }, 410)
    }
    if (!handoff.telegramUserId) {
      throw new HttpException({ error: 'handoff_pending' }, 409)
    }
    await this.kv.del(this.handoffKey(handoff.id))
    const user = this.users.upsertTelegram(handoff.telegramUserId)
    const token = randomBytes(32).toString('base64url')
    const record: SessionRecord = {
      userId: user.id,
      role: user.role,
      name: user.name,
      expiresAt: now + SESSION_TTL_MS,
    }
    await this.kv.set(
      this.sessionKey(token),
      JSON.stringify(record),
      SESSION_CACHE_TTL_SECONDS,
    )
    await this.kv.set(
      this.sessionLongKey(token),
      JSON.stringify(record),
      SESSION_TTL_MS / 1000,
    )
    return { token, maxAgeSeconds: SESSION_TTL_MS / 1000, user }
  }

  async read(token: string | undefined, now = Date.now()) {
    if (!token) return null
    const cached = await this.kv.get(this.sessionKey(token))
    const raw = cached ?? (await this.kv.get(this.sessionLongKey(token)))
    if (!raw) return null
    const session = JSON.parse(raw) as SessionRecord
    if (session.expiresAt <= now) {
      await this.logout(token)
      return null
    }
    session.expiresAt = now + SESSION_TTL_MS
    await this.kv.set(
      this.sessionKey(token),
      JSON.stringify(session),
      SESSION_CACHE_TTL_SECONDS,
    )
    await this.kv.set(
      this.sessionLongKey(token),
      JSON.stringify(session),
      SESSION_TTL_MS / 1000,
    )
    return { userId: session.userId, role: session.role, name: session.name }
  }

  async logout(token: string | undefined) {
    if (!token) return
    await this.kv.del(this.sessionKey(token))
    await this.kv.del(this.sessionLongKey(token))
  }

  userStore() {
    return this.users
  }

  private async readHandoff(id: string) {
    const normalized = normalizeHandoffId(id)
    const raw = await this.kv.get(this.handoffKey(normalized))
    if (!raw) return null
    return JSON.parse(raw) as Handoff
  }

  private handoffKey(id: string) {
    return `handoff:${normalizeHandoffId(id)}`
  }

  private sessionKey(token: string) {
    return `session:cache:${hash(token)}`
  }

  private sessionLongKey(token: string) {
    return `session:${hash(token)}`
  }

  private prune(bucket: Map<string, Hit[]>, key: string, now: number) {
    const fresh = (bucket.get(key) ?? []).filter(
      (hit) => now - hit.at < RATE_WINDOW_MS,
    )
    bucket.set(key, fresh)
    return fresh.length
  }

  private touch(bucket: Map<string, Hit[]>, key: string, now: number) {
    const fresh = bucket.get(key) ?? []
    fresh.push({ at: now })
    bucket.set(key, fresh)
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
