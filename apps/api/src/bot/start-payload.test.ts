import { describe, expect, it } from 'vitest'
import { classifyStartPayload } from './start-payload'

const hex = '01a17ecc6cf37882b3be7d39ce083092'
const dashed = '01a17ecc-6cf3-7882-b3be-7d39ce083092'
const plain = { kind: 'registration', source: null, level: null }

describe('classifyStartPayload', () => {
  it('keeps handoff-shaped payloads as login, dashed or not', () => {
    expect(classifyStartPayload(hex)).toEqual({ kind: 'handoff', raw: hex })
    expect(classifyStartPayload(dashed).kind).toBe('handoff')
  })

  it('reads segment_level and segment from the site link format', () => {
    expect(classifyStartPayload('ielts_orta')).toEqual({
      kind: 'registration',
      source: 'ielts_orta',
      level: 'orta',
    })
    expect(classifyStartPayload('Bolalar')).toEqual({
      kind: 'registration',
      source: 'bolalar',
      level: null,
    })
  })

  it('treats unknown, partial and over-long payloads as plain registration', () => {
    for (const raw of [
      '',
      'hello',
      'ielts_x',
      'ielts_orta_x',
      'x_orta',
      hex.slice(1),
    ]) {
      expect(classifyStartPayload(raw)).toEqual(plain)
    }
  })
})
