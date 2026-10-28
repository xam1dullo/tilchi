import { describe, expect, it } from 'vitest'
import {
  contentLocales,
  ctaHref,
  ctaPayload,
  landing,
  levelIds,
  segmentIds,
} from './landing'
import { landingJsonLd } from './seo'

const PAYLOAD = /^(bolalar|ielts|kattalar)_(boshlovchi|orta|bilmayman)$/

// Leaf paths (arrays collapsed to a length) so ru/en can be compared to uz.
function paths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => paths(item, `${prefix}[${i}]`))
  }
  return Object.entries(value as object).flatMap(([k, v]) =>
    paths(v, `${prefix}.${k}`),
  )
}

describe('landing copy', () => {
  it('has the same keys in uz, ru and en', () => {
    const base = paths(landing.uz)
    for (const locale of contentLocales) {
      expect(paths(landing[locale])).toEqual(base)
    }
  })

  it('has no empty strings', () => {
    const walk = (value: unknown) => {
      if (typeof value === 'string') expect(value.trim()).not.toBe('')
      else if (value && typeof value === 'object')
        Object.values(value).forEach(walk)
    }
    walk(landing)
  })

  it('never mentions CELTA', () => {
    expect(JSON.stringify(landing)).not.toMatch(/celta/i)
  })

  it('renders no price numbers or currency', () => {
    const text = JSON.stringify(landing)
    expect(text).not.toMatch(/\d[\s ]\d{3}/)
    expect(text).not.toMatch(/\d{4,}/)
    expect(text).not.toMatch(/so'm|сум|launch/i)
    for (const locale of contentLocales) {
      expect(landing[locale].courses.price).toMatch(/:/)
    }
  })

  it('carries no stale cohort label', () => {
    const text = JSON.stringify(landing)
    expect(text).not.toContain('Birinchi oqim')
    expect(text).not.toContain('2026-yil avgust')
  })

  it('makes no Zoom claim', () => {
    expect(JSON.stringify(landing)).not.toMatch(/zoom/i)
  })

  it('makes no parent-role or payment-flow claims (v1 has neither)', () => {
    const text = JSON.stringify(landing)
    expect(text).not.toMatch(/ota-ona|родител|parent/i)
    expect(text).not.toMatch(/uzcard|humo|чек|receipt|\bcheki?\b/i)
    expect(text).not.toMatch(/ежемесячн|monthly|oylik/i)
  })

  it('promises groups of up to 12, not 5', () => {
    for (const locale of contentLocales) {
      const copy = landing[locale]
      expect(copy.trust.some((t) => t.dt === '12')).toBe(true)
      expect(copy.trust.some((t) => t.dt === '5')).toBe(false)
      expect(copy.courses.items[0]?.desc).toContain('12')
    }
  })

  it('maps legacy program cards to segments by icon, not position', () => {
    const byTitle = Object.fromEntries(
      landing.uz.segments.cards.map((c) => [c.title, c.segment]),
    )
    expect(byTitle).toEqual({
      Bolalar: 'bolalar',
      IELTS: 'ielts',
      Kattalar: 'kattalar',
    })
  })

  it('has no exclamation marks', () => {
    expect(JSON.stringify(landing)).not.toContain('!')
  })
})

describe('CTA payloads (Decision G2)', () => {
  it('every segment x level payload parses as <segment>_<level>', () => {
    for (const seg of segmentIds) {
      for (const lv of levelIds) {
        expect(ctaPayload(seg, lv)).toMatch(PAYLOAD)
        expect(ctaHref(seg, lv)).toBe(
          `https://t.me/tilchiuz_bot?start=${seg}_${lv}`,
        )
      }
    }
  })

  it('the bare CTA has no start payload', () => {
    expect(ctaHref()).toBe('https://t.me/tilchiuz_bot')
  })

  it('every card and course references a real segment', () => {
    for (const locale of contentLocales) {
      for (const card of landing[locale].segments.cards) {
        expect(segmentIds).toContain(card.segment)
      }
      for (const course of landing[locale].courses.items) {
        for (const seg of course.segments) expect(segmentIds).toContain(seg)
      }
    }
  })
})

describe('landingJsonLd', () => {
  it.each(contentLocales)('has an Organization and Courses in %s', (locale) => {
    const graph = landingJsonLd(locale)['@graph']
    expect(graph.some((n) => n['@type'] === 'EducationalOrganization')).toBe(
      true,
    )
    expect(graph.filter((n) => n['@type'] === 'Course')).toHaveLength(
      landing[locale].courses.items.length,
    )
    expect(JSON.stringify(graph)).not.toMatch(/celta/i)
  })
})
