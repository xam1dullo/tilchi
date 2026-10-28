import { createHash, timingSafeEqual } from 'node:crypto'
import { HANDOFF_TTL_MS } from './policy'

export type Handoff = {
  readonly id: string
  readonly createdAt: number
  readonly bindingHash: string
  readonly context: string
  readonly telegramUserId?: string
  readonly name?: string | null
  readonly confirmedAt?: number
}

export type ClaimResult =
  | { kind: 'ok'; telegramUserId: string; name: string | null }
  | { kind: 'waiting' }
  | { kind: 'wrong_browser' }
  | { kind: 'expired' }

export const bindingHash = (secret: string) =>
  createHash('sha256').update(secret).digest('hex')

const live = (h: Handoff, now: number) => now - h.createdAt <= HANDOFF_TTL_MS

export function newHandoff(input: {
  id: string
  secret: string
  context: string
  now: number
}): Handoff {
  return {
    id: input.id,
    createdAt: input.now,
    bindingHash: bindingHash(input.secret),
    context: input.context,
  }
}

/** The bot saw `/start <id>`. The first Telegram user to arrive owns it. */
export function bindTelegramUser(
  h: Handoff,
  who: { telegramUserId: string; name: string | null },
  now: number,
): Handoff | null {
  if (!live(h, now)) return null
  if (h.telegramUserId && h.telegramUserId !== who.telegramUserId) return null
  return { ...h, telegramUserId: who.telegramUserId, name: who.name }
}

/** The confirm tap counts only from the Telegram user already bound. */
export function confirmByTelegramUser(
  h: Handoff,
  telegramUserId: string,
  now: number,
): Handoff | null {
  if (!live(h, now) || h.telegramUserId !== telegramUserId) return null
  return { ...h, confirmedAt: now }
}

/** Browser-side claim. Needs the bot confirmation and the starting browser. */
export function claimHandoff(
  h: Handoff,
  browserSecret: string | undefined,
  now: number,
): ClaimResult {
  if (!live(h, now)) return { kind: 'expired' }
  if (!browserSecret || !sameHash(bindingHash(browserSecret), h.bindingHash)) {
    return { kind: 'wrong_browser' }
  }
  if (!h.confirmedAt || !h.telegramUserId) return { kind: 'waiting' }
  return {
    kind: 'ok',
    telegramUserId: h.telegramUserId,
    name: h.name ?? null,
  }
}

function sameHash(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
