import { describe, expect, it } from 'vitest'
import { faqLd, ieltsCourseLd, groupCourseLd } from './seo'
import { faqs } from './domain/faqs'

describe('SEO Schema and Domain Parity (Drift-Free)', () => {
  it('faqLd should accurately reflect domain faqs without drift', () => {
    expect(faqLd['@type']).toBe('FAQPage')
    expect(faqLd.mainEntity.length).toBe(faqs.length)
    faqLd.mainEntity.forEach((entity, idx) => {
      expect(entity['@type']).toBe('Question')
      expect(entity.name).toBe(faqs[idx].q)
      expect(entity.acceptedAnswer.text).toBe(faqs[idx].a)
    })
  })

  it('course schema publishes no prices (pricing is by agreement)', () => {
    expect('offers' in ieltsCourseLd).toBe(false)
    expect('offers' in groupCourseLd).toBe(false)
  })
})
