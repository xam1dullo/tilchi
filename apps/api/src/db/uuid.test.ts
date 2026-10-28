import { describe, expect, it } from 'vitest'
import { uuidv7 } from '../id'
import { isUuid } from './uuid'

describe('isUuid', () => {
  it('accepts a generated v7 id and any letter case', () => {
    const id = uuidv7()
    expect(isUuid(id)).toBe(true)
    expect(isUuid(id.toUpperCase())).toBe(true)
    expect(isUuid('0199aaa0-0000-7000-8000-000000000010')).toBe(true)
  })

  it('refuses anything Postgres would reject or reinterpret', () => {
    for (const value of [
      '',
      't1',
      'nope',
      '0199aaa000007000800000000000010',
      '{0199aaa0-0000-7000-8000-000000000010}',
      '0199aaa0-0000-7000-8000-00000000001',
      '0199aaa0-0000-7000-8000-0000000000100',
      '0199aaa0-0000-7000-8000-00000000001g',
      "0199aaa0-0000-7000-8000-000000000010'; --",
      ' 0199aaa0-0000-7000-8000-000000000010',
    ]) {
      expect(isUuid(value)).toBe(false)
    }
  })
})
