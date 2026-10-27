import { HttpException, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import {
  HANDOFF_TTL_MS,
  RATE_WINDOW_MS,
  SESSION_TTL_MS,
  decideAuthStart,
} from './policy'
import { uuidv7 } from '../id'

type Hit = { at: number }

export type Handoff = { id: string; createdAt: number }

@Injectable()
export class AuthService {
  private readonly ipHits = new Map<string, Hit[]>()
  private readonly telegramHits = new Map<string, Hit[]>()
  private readonly handoffs = new Map<string, Handoff>()
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
    const handoff: Handoff = { id: uuidv7(), createdAt: now }
    this.handoffs.set(handoff.id, handoff)
    return { handoffId: handoff.id, expiresInSeconds: HANDOFF_TTL_MS / 1000 }
  }

  confirm(handoffId: string, now = Date.now()) {
    const handoff = this.handoffs.get(handoffId)
    if (!handoff || now - handoff.createdAt > HANDOFF_TTL_MS) {
      this.handoffs.delete(handoffId)
      throw new HttpException({ error: 'handoff_expired' }, 410)
    }
    this.handoffs.delete(handoffId)
    const token = randomBytes(32).toString('base64url')
    this.sessions.set(token, {
      userId: uuidv7(),
      expiresAt: now + SESSION_TTL_MS,
    })
    return { token, maxAgeSeconds: SESSION_TTL_MS / 1000 }
  }

  read(token: string | undefined, now = Date.now()) {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session || session.expiresAt <= now) {
      if (token) this.sessions.delete(token)
      return null
    }
    session.expiresAt = now + SESSION_TTL_MS
    return { userId: session.userId, role: 'learner' as const }
  }

  logout(token: string | undefined) {
    if (token) this.sessions.delete(token)
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
