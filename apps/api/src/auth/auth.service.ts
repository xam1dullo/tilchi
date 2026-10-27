import { HttpException, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { uuidv7 } from '../id'
import {
  HANDOFF_TTL_MS,
  RATE_WINDOW_MS,
  SESSION_TTL_MS,
  decideAuthStart,
  safeEqual,
} from './policy'

type Hit = { at: number }

type Handoff = {
  id: string
  secret: string
  createdAt: number
  userId?: string
}

export type ClaimResult =
  | { status: 'waiting' }
  | { status: 'expired' }
  | { status: 'confirmed'; token: string; maxAgeSeconds: number }

// ponytail: in-memory stores, single process; Postgres + Redis replace them (ADR 0002)
@Injectable()
export class AuthService {
  private readonly ipHits = new Map<string, Hit[]>()
  private readonly telegramHits = new Map<string, Hit[]>()
  private readonly handoffs = new Map<string, Handoff>()
  private readonly usersByTelegram = new Map<string, string>()
  private readonly sessions = new Map<
    string,
    { userId: string; expiresAt: number }
  >()

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
    const handoff: Handoff = {
      id: uuidv7(now),
      secret: randomBytes(32).toString('base64url'),
      createdAt: now,
    }
    this.handoffs.set(handoff.id, handoff)
    return {
      handoffId: handoff.id,
      claim: `${handoff.id}.${handoff.secret}`,
      expiresInSeconds: HANDOFF_TTL_MS / 1000,
    }
  }

  // Bot-only: called after the Telegram user taps confirm. Never routed over HTTP.
  confirm(handoffId: string, telegramUserId: string, now = Date.now()) {
    const handoff = this.live(handoffId, now)
    if (!handoff) return false
    handoff.userId = this.userFor(telegramUserId)
    return true
  }

  claim(claim: string | undefined, now = Date.now()): ClaimResult {
    const [id = '', secret = ''] = (claim ?? '').split('.')
    const handoff = this.live(id, now)
    if (!handoff || !safeEqual(secret, handoff.secret)) {
      return { status: 'expired' }
    }
    if (!handoff.userId) return { status: 'waiting' }
    this.handoffs.delete(id)
    const token = randomBytes(32).toString('base64url')
    this.sessions.set(token, {
      userId: handoff.userId,
      expiresAt: now + SESSION_TTL_MS,
    })
    return { status: 'confirmed', token, maxAgeSeconds: SESSION_TTL_MS / 1000 }
  }

  read(token: string | undefined, now = Date.now()) {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session || session.expiresAt <= now) {
      this.sessions.delete(token)
      return null
    }
    session.expiresAt = now + SESSION_TTL_MS
    return { userId: session.userId, role: 'learner' as const }
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

  private userFor(telegramUserId: string) {
    const known = this.usersByTelegram.get(telegramUserId)
    if (known) return known
    const userId = uuidv7()
    this.usersByTelegram.set(telegramUserId, userId)
    return userId
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
