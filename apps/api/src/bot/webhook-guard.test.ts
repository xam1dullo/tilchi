import { describe, expect, it } from 'vitest'
import {
  WEBHOOK_SECRET_MIN_LENGTH,
  decideWebhook,
  webhookProblem,
} from './webhook-guard'

const STRONG = 'k'.repeat(WEBHOOK_SECRET_MIN_LENGTH)
const SHORT = 'k'.repeat(WEBHOOK_SECRET_MIN_LENGTH - 1)

describe('decideWebhook', () => {
  it('refuses an unset secret in production', () => {
    expect(
      decideWebhook({ nodeEnv: 'production', secret: '', header: 'anything' }),
    ).toBe('refuse_unset')
    expect(
      decideWebhook({
        nodeEnv: 'production',
        secret: undefined,
        header: undefined,
      }),
    ).toBe('refuse_unset')
  })

  it('allows an unset secret on a developer machine and in tests', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(
        decideWebhook({ nodeEnv, secret: undefined, header: undefined }),
      ).toBe('allow')
    }
  })

  it('treats any other environment like production', () => {
    for (const nodeEnv of ['staging', 'preview', '']) {
      expect(
        decideWebhook({ nodeEnv, secret: undefined, header: undefined }),
      ).toBe('refuse_unset')
    }
  })

  it('requires the telegram header to match and ignores nothing else', () => {
    expect(
      decideWebhook({
        nodeEnv: 'production',
        secret: STRONG,
        header: STRONG,
      }),
    ).toBe('allow')
    expect(
      decideWebhook({
        nodeEnv: 'production',
        secret: STRONG,
        header: 'nope',
      }),
    ).toBe('bad_header')
    expect(
      decideWebhook({
        nodeEnv: 'production',
        secret: STRONG,
        header: undefined,
      }),
    ).toBe('bad_header')
  })

  it('refuses a short secret outside a developer machine, even with the right header', () => {
    for (const nodeEnv of ['production', 'staging', '']) {
      expect(decideWebhook({ nodeEnv, secret: SHORT, header: SHORT })).toBe(
        'refuse_weak',
      )
    }
  })

  it('counts the secret as the server reads it, without surrounding spaces', () => {
    const padded = `  ${SHORT}  `
    expect(
      decideWebhook({
        nodeEnv: 'production',
        secret: padded,
        header: SHORT,
      }),
    ).toBe('refuse_weak')
  })

  it('lets a developer machine and tests use any secret', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(
        decideWebhook({ nodeEnv, secret: 's3cret', header: 's3cret' }),
      ).toBe('allow')
      expect(decideWebhook({ nodeEnv, secret: 's3cret', header: 'nope' })).toBe(
        'bad_header',
      )
    }
  })
})

describe('webhookProblem', () => {
  it('names what is wrong, so a refusal is not silent', () => {
    expect(
      webhookProblem({ nodeEnv: 'production', secret: undefined }),
    ).toMatch(/not set/)
    expect(webhookProblem({ nodeEnv: 'production', secret: SHORT })).toMatch(
      new RegExp(`${WEBHOOK_SECRET_MIN_LENGTH} characters`),
    )
  })

  it('stays quiet when the webhook works', () => {
    expect(webhookProblem({ nodeEnv: 'production', secret: STRONG })).toBeNull()
    expect(
      webhookProblem({ nodeEnv: 'development', secret: undefined }),
    ).toBeNull()
    expect(
      webhookProblem({ nodeEnv: 'development', secret: 's3cret' }),
    ).toBeNull()
  })
})
