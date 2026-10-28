import { describe, expect, it } from 'vitest'
import {
  databaseUrl,
  productionConfigErrors,
  readBootstrapConfig,
} from './config'

describe('readBootstrapConfig', () => {
  it('defaults to port 3001 and parses a configured port', () => {
    expect(readBootstrapConfig({})).toEqual({
      ok: true,
      config: { port: 3001 },
    })
    expect(readBootstrapConfig({ PORT: '8080' })).toEqual({
      ok: true,
      config: { port: 8080 },
    })
  })

  it('rejects invalid listen ports without echoing their values', () => {
    for (const PORT of [
      '',
      ' ',
      '0',
      '-1',
      '65536',
      '1.5',
      'abc',
      '1e3',
      '0x50',
    ]) {
      expect(readBootstrapConfig({ PORT })).toEqual({
        ok: false,
        errors: ['PORT must be an integer between 1 and 65535'],
      })
    }
  })

  it('keeps all production validation before bootstrap', () => {
    const result = readBootstrapConfig({ NODE_ENV: 'production' })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.errors.join()).toContain('TELEGRAM_WEBHOOK_SECRET')
  })
})

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

  it('refuses demo and preview flags in production', () => {
    const demo = productionConfigErrors({ ...good, TILCHI_DEMO: '1' })
    expect(demo.join()).toMatch(/TILCHI_DEMO/)
    const preview = productionConfigErrors({
      ...good,
      TILCHI_PREVIEW_ROLE: 'teacher',
    })
    expect(preview.join()).toMatch(/TILCHI_PREVIEW_ROLE/)
    expect(preview.join()).not.toContain('teacher')
    expect(productionConfigErrors(good)).toEqual([])
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

describe('databaseUrl', () => {
  const url = 'postgres://u:p@postgres:5432/tilchi'

  it('returns the configured url, trimmed', () => {
    expect(
      databaseUrl({ NODE_ENV: 'production', DATABASE_URL: ` ${url} ` }),
    ).toBe(url)
  })

  it('fails boot with a message that names the variable, outside tests', () => {
    for (const NODE_ENV of ['production', 'development', undefined]) {
      for (const DATABASE_URL of [undefined, '', '   ']) {
        expect(() => databaseUrl({ NODE_ENV, DATABASE_URL })).toThrow(
          /DATABASE_URL is required/,
        )
      }
    }
  })

  it('lets a test boot without one, pointed at nothing real', () => {
    const placeholder = databaseUrl({ NODE_ENV: 'test' })
    expect(new URL(placeholder).hostname).toBe('127.0.0.1')
    expect(new URL(placeholder).port).toBe('1')
  })

  it('prefers a configured url in tests', () => {
    expect(databaseUrl({ NODE_ENV: 'test', DATABASE_URL: url })).toBe(url)
  })
})
