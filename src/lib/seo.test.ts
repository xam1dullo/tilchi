import { describe, expect, it } from 'vitest'
import { faqLd, ieltsCourseLd, groupCourseLd } from './seo'
import { faqs } from './domain/faqs'
import { prices } from './site'

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

  it('course Schema offers should match canonical domain pricing without drift', () => {
    expect(ieltsCourseLd.offers.price).toBe(String(prices.indiv.launch))
    expect(groupCourseLd.offers.price).toBe(String(prices.group.launch))
  })
})
