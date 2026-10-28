import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LandingPage } from './components/landing/landing'
import { locales } from './lib/locale'
import { landingHead } from './routes/index'

describe.each(locales)('landing in %s', (locale) => {
  const html = renderToStaticMarkup(createElement(LandingPage, { locale }))

  it('renders every section and the Kirish link to /app', () => {
    for (const id of ['programs', 'teacher', 'faq']) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html).toContain('href="/app"')
    expect(html).toContain('<footer')
  })

  it('every bot link is bare or a valid <segment>_<level> payload', () => {
    const links = [...html.matchAll(/href="(https:\/\/t\.me\/[^"]+)"/g)].map(
      (m) => m[1] as string,
    )
    expect(links.length).toBeGreaterThan(5)
    for (const link of links) {
      const start = new URL(link).searchParams.get('start')
      if (start !== null) {
        expect(start).toMatch(
          /^(bolalar|ielts|kattalar)_(boshlovchi|orta|bilmayman)$/,
        )
      }
    }
  })

  it('shows no CELTA and no price numbers', () => {
    expect(html).not.toMatch(/celta/i)
    expect(html).not.toMatch(/\d[\s ]\d{3}|so'm|сум/i)
  })

  it('ships title, OG tags and Organization + Course JSON-LD', () => {
    const head = landingHead(locale)
    const names = head.meta.map((m) => ('property' in m ? m.property : m.name))
    expect(names).toEqual(expect.arrayContaining(['description', 'og:title']))
    const ld = JSON.parse(head.scripts[0]?.children ?? '{}')
    const types = ld['@graph'].map((n: { '@type': string }) => n['@type'])
    expect(types).toContain('EducationalOrganization')
    expect(types).toContain('Course')
  })
})
