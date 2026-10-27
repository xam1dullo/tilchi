import { safeEqual } from '../auth/policy'

export type WebhookDecision = 'allow' | 'refuse_unset' | 'bad_header'

// The webhook confirms logins, so only a developer machine may run it open.
// Production, staging and anything unnamed refuse until the secret is set.
const OPEN_ENVIRONMENTS = new Set(['development', 'test'])

export function decideWebhook(input: {
  nodeEnv: string
  secret: string | undefined
  header: string | undefined
}): WebhookDecision {
  const secret = input.secret?.trim() ?? ''
  if (!secret) {
    return OPEN_ENVIRONMENTS.has(input.nodeEnv) ? 'allow' : 'refuse_unset'
  }
  if (!safeEqual(input.header ?? '', secret)) return 'bad_header'
  return 'allow'
}
