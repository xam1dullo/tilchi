import { describe, expect, it } from 'vitest'
import { productionConfigErrors } from './config'

const good = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@postgres:5432/tilchi',
  REDIS_URL: 'redis://redis:6379',
  TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(40),
  LIVEKIT_API_KEY: 'APIprodkey',
  LIVEKIT_API_SECRET: 'b'.repeat(40),
}

describe('productionConfigErrors', () => {
  it('accepts a complete production env', () => {
    expect(productionConfigErrors(good)).toEqual([])
  })

  it('ignores development', () => {
    expect(productionConfigErrors({ NODE_ENV: 'development' })).toEqual([])
  })

  it('requires the webhook secret in production', () => {
    const errors = productionConfigErrors({
      ...good,
      TELEGRAM_WEBHOOK_SECRET: '',
    })
    expect(errors.join()).toMatch(/TELEGRAM_WEBHOOK_SECRET/)
  })

  it('refuses the local LiveKit dev pair', () => {
    const errors = productionConfigErrors({
      ...good,
      LIVEKIT_API_KEY: 'devkey',
      LIVEKIT_API_SECRET: 'devsecret',
    })
    expect(errors.join()).toMatch(/LIVEKIT_API_KEY/)
    expect(errors.join()).toMatch(/LIVEKIT_API_SECRET/)
  })

  it('never echoes a secret value', () => {
    const secret = 'short-but-secret'
    const errors = productionConfigErrors({
      ...good,
      TELEGRAM_WEBHOOK_SECRET: secret,
      LIVEKIT_API_SECRET: secret,
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.join()).not.toContain(secret)
  })
})
