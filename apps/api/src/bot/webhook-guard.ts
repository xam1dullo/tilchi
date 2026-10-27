import { safeEqual } from '../auth/policy'

export type WebhookDecision =
  | 'allow'
  | 'refuse_unset'
  | 'refuse_weak'
  | 'bad_header'

// The webhook confirms logins, so only a developer machine may run it open.
// Production, staging and anything unnamed refuse until the secret is set.
const OPEN_ENVIRONMENTS = new Set(['development', 'test'])

// Telegram takes up to 256 characters. The secret is the only proof that an
// update came from the bot, and an update can sign in as any Telegram user, so
// outside a developer machine a short one is as bad as none.
export const WEBHOOK_SECRET_MIN_LENGTH = 32

export function decideWebhook(input: {
  nodeEnv: string
  secret: string | undefined
  header: string | undefined
}): WebhookDecision {
  const secret = input.secret?.trim() ?? ''
  const open = OPEN_ENVIRONMENTS.has(input.nodeEnv)
  if (!secret) return open ? 'allow' : 'refuse_unset'
  if (!open && secret.length < WEBHOOK_SECRET_MIN_LENGTH) return 'refuse_weak'
  if (!safeEqual(input.header ?? '', secret)) return 'bad_header'
  return 'allow'
}

// Why the webhook refuses everything, or null when it works. The refusal is a
// bare 503, so the server logs this once at start.
export function webhookProblem(input: {
  nodeEnv: string
  secret: string | undefined
}): string | null {
  const decision = decideWebhook({ ...input, header: undefined })
  if (decision === 'refuse_unset') return 'TELEGRAM_WEBHOOK_SECRET is not set'
  if (decision === 'refuse_weak') {
    return `TELEGRAM_WEBHOOK_SECRET is shorter than ${WEBHOOK_SECRET_MIN_LENGTH} characters`
  }
  return null
}
