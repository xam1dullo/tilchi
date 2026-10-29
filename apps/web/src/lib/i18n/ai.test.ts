import { describe, expect, it } from 'vitest'
import { aiCopy } from './ai'

describe('AI helper copy', () => {
  it('has the same keys in uz, ru and en, with no exclamation marks', () => {
    const keys = Object.keys(aiCopy.uz)
    expect(Object.keys(aiCopy.ru)).toEqual(keys)
    expect(Object.keys(aiCopy.en)).toEqual(keys)
    for (const catalog of Object.values(aiCopy)) {
      for (const value of Object.values(catalog)) {
        expect(value.includes('!')).toBe(false)
      }
    }
  })
})
