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
