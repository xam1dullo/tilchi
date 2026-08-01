import { describe, expect, it } from 'vitest'
import { faqs } from './faqs'
import { programs } from './programs'

describe('Domain Modules', () => {
  it('should export non-empty faqs list with valid structure', () => {
    expect(faqs.length).toBeGreaterThan(0)
    faqs.forEach((item) => {
      expect(typeof item.q).toBe('string')
      expect(item.q.length).toBeGreaterThan(0)
      expect(typeof item.a).toBe('string')
      expect(item.a.length).toBeGreaterThan(0)
    })
  })

  it('should export programs with valid iconId tokens', () => {
    expect(programs.length).toBeGreaterThan(0)
    const allowedIconIds = ['kids', 'ielts', 'adults'] as const
    programs.forEach((item) => {
      expect(allowedIconIds).toContain(item.iconId)
      expect(typeof item.title).toBe('string')
      expect(item.items.length).toBeGreaterThan(0)
    })
  })
})
