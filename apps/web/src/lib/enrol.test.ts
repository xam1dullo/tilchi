import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  canSearch,
  consentByValid,
  displayName,
  enrolError,
  needsConsent,
  searchPath,
  type LearnerHit,
} from './enrol'

const hit = (guardianConsent: boolean): LearnerHit => ({
  id: 'u1',
  name: 'Ali',
  level: 'A1',
  guardianConsent,
})

describe('enrol helpers', () => {
  it('searches only from 2 trimmed characters and encodes the query', () => {
    expect(canSearch(' a ')).toBe(false)
    expect(canSearch('al')).toBe(true)
    expect(searchPath(' a&b%_ ')).toBe('/api/users?q=a%26b%25_')
  })

  it('asks for consent only for a kids group without consent on record', () => {
    expect(needsConsent('kids', hit(false))).toBe(true)
    expect(needsConsent('kids', hit(true))).toBe(false)
    expect(needsConsent('adult', hit(false))).toBe(false)
  })

  it('accepts a consent giver of 1..120 trimmed characters', () => {
    expect(consentByValid('  ')).toBe(false)
    expect(consentByValid(' Mother ')).toBe(true)
    expect(consentByValid(` ${'x'.repeat(120)} `)).toBe(true)
    expect(consentByValid('x'.repeat(121))).toBe(false)
  })

  it('maps API errors to copy keys, anything else to the generic one', () => {
    const api = (error: string) => new ApiError(409, { error })
    expect(enrolError(api('group_full'))).toBe('groupFull')
    expect(enrolError(new ApiError(404, { error: 'user_not_found' }))).toBe(
      'userNotFound',
    )
    expect(enrolError(api('guardian_consent_required'))).toBe(
      'guardianConsentRequired',
    )
    expect(enrolError(api('toString'))).toBe('enrolFailed')
    expect(enrolError(new TypeError('network'))).toBe('enrolFailed')
    expect(enrolError('nope')).toBe('enrolFailed')
  })

  it('falls back to a short id when a person has no name', () => {
    expect(displayName({ id: 'abcdef123456', name: null })).toBe('abcdef12')
    expect(displayName({ id: 'x', name: 'Ali' })).toBe('Ali')
  })
})
