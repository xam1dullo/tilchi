import { describe, expect, it } from 'vitest'
import {
  databaseUrl,
  productionConfigErrors,
  readBootstrapConfig,
  storageConfig,
  telegramBotUsername,
} from './config'

describe('Telegram bot username', () => {
  it('defaults only when absent and rejects invalid configured values without echoing them', () => {
    expect(telegramBotUsername({})).toBe('tilchiuz_bot')
    expect(
      telegramBotUsername({ TELEGRAM_BOT_USERNAME: ' deno_blogbot ' }),
    ).toBe('deno_blogbot')
    for (const value of [
      'abc',
      'bad/name',
      'evil?start=secret',
      'x'.repeat(33),
    ]) {
      const result = readBootstrapConfig({ TELEGRAM_BOT_USERNAME: value })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors.join()).toContain('TELEGRAM_BOT_USERNAME')
        expect(result.errors.join()).not.toContain(value)
      }
    }
  })
})

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
  S3_ENDPOINT: 'http://minio:9000',
  S3_PUBLIC_URL: 'https://files.tilchi.uz',
  S3_ACCESS_KEY: 'tilchi-prod-access',
  S3_SECRET_KEY: 'c'.repeat(32),
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

describe('storage config', () => {
  it('defaults to a local MinIO in development', () => {
    expect(storageConfig({})).toMatchObject({
      endpoint: 'http://localhost:9000',
      publicUrl: 'http://localhost:9000',
      bucket: 'tilchi-audio',
    })
  })

  it('refuses a path in the public url: presigned hosts must be origins', () => {
    expect(() =>
      storageConfig({ S3_PUBLIC_URL: 'https://tilchi.uz/storage' }),
    ).toThrow(/S3_PUBLIC_URL/)
    expect(() => storageConfig({ S3_BUCKET: 'Bad_Name' })).toThrow(/S3_BUCKET/)
  })

  it('refuses dev credentials, short secrets and plain http in production', () => {
    for (const patch of [
      { S3_ACCESS_KEY: 'minioadmin' },
      { S3_SECRET_KEY: 'tilchi-dev-secret' },
      { S3_SECRET_KEY: 'short' },
      { S3_PUBLIC_URL: 'http://files.tilchi.uz' },
      { S3_ENDPOINT: '' },
    ]) {
      expect(
        productionConfigErrors({ ...good, ...patch }).length,
        JSON.stringify(Object.keys(patch)),
      ).toBeGreaterThan(0)
    }
    expect(
      productionConfigErrors({ ...good, S3_SECRET_KEY: undefined }).join(),
    ).toContain('S3_SECRET_KEY')
  })

  it('accepts a 16 char secret, the shortest allowed', () => {
    expect(
      productionConfigErrors({ ...good, S3_SECRET_KEY: 'd'.repeat(16) }),
    ).toEqual([])
  })
})
