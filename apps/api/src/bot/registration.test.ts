import { describe, expect, it } from 'vitest'
import {
  CONSENT_VERSION,
  type Registration,
  hasConsent,
  nextField,
  parseAnswer,
} from './registration'

const empty: Registration = {
  userId: 'u',
  name: null,
  level: null,
  studyHistory: null,
  phone: null,
  goal: null,
  source: null,
  consentAt: null,
  consentVersion: null,
}

describe('registration shape', () => {
  it('asks the first unanswered field and ends when all are answered', () => {
    expect(nextField(empty)).toBe('name')
    expect(nextField({ ...empty, name: 'Ada', level: 'orta' })).toBe(
      'studyHistory',
    )
    const done = {
      ...empty,
      name: 'a',
      level: 'b',
      studyHistory: 'c',
      phone: 'd',
      goal: 'e',
    }
    expect(nextField(done)).toBeNull()
  })

  it('counts consent only for the current notice version', () => {
    const at = new Date()
    expect(
      hasConsent({ ...empty, consentAt: at, consentVersion: CONSENT_VERSION }),
    ).toBe(true)
    expect(hasConsent({ ...empty, consentAt: at, consentVersion: 'old' })).toBe(
      false,
    )
    expect(hasConsent(empty)).toBe(false)
  })

  it('normalises phones and rejects junk and oversize answers', () => {
    expect(parseAnswer('phone', '+998 90 123-45-67')).toBe('+998901234567')
    expect(parseAnswer('phone', 'call me')).toBeNull()
    expect(parseAnswer('phone', '12')).toBeNull()
    expect(parseAnswer('name', '  Ada   Lovelace ')).toBe('Ada Lovelace')
    expect(parseAnswer('goal', '   ')).toBeNull()
    expect(parseAnswer('goal', 'x'.repeat(301))).toBeNull()
  })
})
