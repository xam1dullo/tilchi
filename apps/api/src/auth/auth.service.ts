import { randomBytes } from 'node:crypto'
import { HttpException, Inject, Injectable } from '@nestjs/common'
import { uuidv7 } from '../id'
import { RoleAllowlist } from '../users/roles'
import { UsersRepository } from '../users/users.repository'
import { deviceLabel } from './device'
import {
  HANDOFF_TTL_MS,
  RATE_WINDOW_MS,
  type Role,
  SESSION_TTL_MS,
  decideAuthStart,
  safeEqual,
} from './policy'

type Hit = { at: number }

export type UserDirectory = Pick<UsersRepository, 'upsertTelegram'>

// What the bot shows next to the confirm button so the account owner can tell
// whose login it is (ADR 0002).
export type HandoffContext = { device: string; at: number }

export type TelegramAccount = { id: string; name?: string | null }

export type SessionUser = { userId: string; role: Role; name: string | null }

type Handoff = {
  id: string
  secret: string
  createdAt: number
  context: HandoffContext
  // Set synchronously by the first confirm, before the user lookup is awaited.
  confirming: boolean
  user?: SessionUser
}

export type ClaimResult =
  | { status: 'waiting' }
  | { status: 'expired' }
  | { status: 'confirmed'; token: string; maxAgeSeconds: number }

// ponytail: sessions and handoffs live in memory, single process; Postgres and
// Redis replace them (ADR 0002). Users are already persistent.
@Injectable()
export class AuthService {
  private readonly ipHits = new Map<string, Hit[]>()
  private readonly telegramHits = new Map<string, Hit[]>()
  private readonly handoffs = new Map<string, Handoff>()
  private readonly sessions = new Map<
    string,
    SessionUser & { expiresAt: number }
  >()
  private lastSweepAt = 0

  constructor(
    @Inject(UsersRepository) private readonly users: UserDirectory,
    @Inject(RoleAllowlist) private readonly roles: RoleAllowlist,
  ) {}

  // telegramKey must be a verified Telegram user id (Mini App initData), never request body input.
  start(input: {
    ip: string
    telegramKey?: string
    userAgent?: string
    now?: number
  }) {
    const now = input.now ?? Date.now()
    this.sweep(now)
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
    const handoff: Handoff = {
      id: uuidv7(now),
      secret: randomBytes(32).toString('base64url'),
      createdAt: now,
      context: { device: deviceLabel(input.userAgent), at: now },
      confirming: false,
    }
    this.handoffs.set(handoff.id, handoff)
    return {
      handoffId: handoff.id,
      claim: `${handoff.id}.${handoff.secret}`,
      expiresInSeconds: HANDOFF_TTL_MS / 1000,
    }
  }

  // Bot-only, read-only: the context for the confirm prompt, or null when the
  // handoff is unknown, expired or already taken.
  preview(handoffId: string, now = Date.now()): HandoffContext | null {
    const handoff = this.live(handoffId, now)
    return handoff && !handoff.user && !handoff.confirming
      ? handoff.context
      : null
  }

  // Bot-only: called after the Telegram user taps confirm. Never routed over HTTP.
  // First confirm wins, so a forwarded deep link cannot swap the account.
  // False when the handoff is gone or taken, or the account is disabled; a
  // failed attempt leaves the handoff open for the next confirm.
  async confirm(
    handoffId: string,
    account: TelegramAccount,
    now = Date.now(),
  ): Promise<boolean> {
    const handoff = this.live(handoffId, now)
    if (!handoff || handoff.user || handoff.confirming) return false
    handoff.confirming = true
    try {
      const user = await this.users.upsertTelegram({
        telegramUserId: account.id,
        role: this.roles.roleFor(account.id),
        name: account.name,
      })
      if (!user) return false
      handoff.user = { userId: user.id, role: user.role, name: user.name }
      return true
    } finally {
      handoff.confirming = false
    }
  }

  claim(claim: string | undefined, now = Date.now()): ClaimResult {
    const [id = '', secret = ''] = (claim ?? '').split('.')
    const handoff = this.live(id, now)
    if (!handoff || !safeEqual(secret, handoff.secret)) {
      return { status: 'expired' }
    }
    if (!handoff.user) return { status: 'waiting' }
    this.handoffs.delete(id)
    const token = randomBytes(32).toString('base64url')
    this.sessions.set(token, {
      ...handoff.user,
      expiresAt: now + SESSION_TTL_MS,
    })
    return { status: 'confirmed', token, maxAgeSeconds: SESSION_TTL_MS / 1000 }
  }

  read(token: string | undefined, now = Date.now()): SessionUser | null {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session || session.expiresAt <= now) {
      this.sessions.delete(token)
      return null
    }
    session.expiresAt = now + SESSION_TTL_MS
    return { userId: session.userId, role: session.role, name: session.name }
  }

  logout(token: string | undefined) {
    if (token) this.sessions.delete(token)
  }

  private live(id: string, now: number) {
    const handoff = this.handoffs.get(id)
    if (handoff && now - handoff.createdAt <= HANDOFF_TTL_MS) return handoff
    this.handoffs.delete(id)
    return undefined
  }

  // Handoffs are inserted in creation order, so the oldest come first.
  // Rate buckets are swept at most once per window so a flood of distinct
  // addresses cannot make every start request walk the whole map.
  private sweep(now: number) {
    for (const [id, handoff] of this.handoffs) {
      if (now - handoff.createdAt <= HANDOFF_TTL_MS) break
      this.handoffs.delete(id)
    }
    if (now - this.lastSweepAt < RATE_WINDOW_MS) return
    this.lastSweepAt = now
    for (const bucket of [this.ipHits, this.telegramHits]) {
      for (const key of [...bucket.keys()]) this.prune(bucket, key, now)
    }
  }

  private prune(bucket: Map<string, Hit[]>, key: string, now: number) {
    const fresh = (bucket.get(key) ?? []).filter(
      (hit) => now - hit.at < RATE_WINDOW_MS,
    )
    if (fresh.length === 0) bucket.delete(key)
    else bucket.set(key, fresh)
    return fresh.length
  }

  private touch(bucket: Map<string, Hit[]>, key: string, now: number) {
    const fresh = bucket.get(key) ?? []
    fresh.push({ at: now })
    bucket.set(key, fresh)
  }
}
