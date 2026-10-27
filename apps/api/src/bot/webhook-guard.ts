import { safeEqual } from '../auth/policy'

export type WebhookDecision = 'allow' | 'refuse_unset' | 'bad_header'

export function decideWebhook(input: {
  nodeEnv: string
  secret: string | undefined
  header: string | undefined
}): WebhookDecision {
  const secret = input.secret?.trim() ?? ''
  if (!secret) return input.nodeEnv === 'production' ? 'refuse_unset' : 'allow'
  if (!safeEqual(input.header ?? '', secret)) return 'bad_header'
  return 'allow'
}
