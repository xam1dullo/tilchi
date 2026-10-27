import { timingSafeEqual } from 'node:crypto'

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

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
