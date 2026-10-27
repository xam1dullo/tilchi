import { describe, expect, it } from 'vitest'
import { decideWebhook } from './webhook-guard'

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

  it('allows an unset secret outside production', () => {
    expect(
      decideWebhook({
        nodeEnv: 'development',
        secret: undefined,
        header: undefined,
      }),
    ).toBe('allow')
  })

  it('requires the telegram header to match and ignores nothing else', () => {
    expect(
      decideWebhook({
        nodeEnv: 'production',
        secret: 's3cret',
        header: 's3cret',
      }),
    ).toBe('allow')
    expect(
      decideWebhook({
        nodeEnv: 'production',
        secret: 's3cret',
        header: 'nope',
      }),
    ).toBe('bad_header')
    expect(
      decideWebhook({
        nodeEnv: 'production',
        secret: 's3cret',
        header: undefined,
      }),
    ).toBe('bad_header')
  })
})
