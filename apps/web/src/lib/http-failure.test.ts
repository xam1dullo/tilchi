import { describe, expect, it } from 'vitest'
import { apiFailure, isForbidden } from './http-failure'

describe('apiFailure', () => {
  it('marks a 403 so the page can show the forbidden screen', () => {
    expect(isForbidden(apiFailure(403))).toBe(true)
  })

  it('still reads as a 403 after the router serialized it, which keeps only the message', () => {
    expect(isForbidden(new Error(apiFailure(403).message))).toBe(true)
  })

  it('treats every other status and every non-error as an ordinary failure', () => {
    for (const status of [400, 401, 404, 429, 500, 503]) {
      expect(isForbidden(apiFailure(status))).toBe(false)
    }
    expect(isForbidden(new Error('api_4030'))).toBe(false)
    expect(isForbidden('api_403')).toBe(false)
    expect(isForbidden({ message: 'api_403' })).toBe(false)
    expect(isForbidden(null)).toBe(false)
  })
})
