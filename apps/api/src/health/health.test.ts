import { describe, expect, it } from 'vitest'
import { healthBody } from './health.controller'

describe('health', () => {
  it('reports the api service without secret flags', () => {
    const body = healthBody()
    expect(body).toEqual({ ok: true, service: 'tilchi-api' })
    expect(Object.keys(body).sort()).toEqual(['ok', 'service'])
    expect(JSON.stringify(body)).not.toMatch(
      /token|secret|database|hasBot|hasDb/i,
    )
  })
})
