import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LandingPage } from './components/landing/landing'

it('uses the configured bot on all landing links and hides them if unavailable', () => {
  const configured = renderToStaticMarkup(
    createElement(LandingPage, { locale: 'uz', botUsername: 'deno_blogbot' }),
  )
  expect(configured).toContain('https://t.me/deno_blogbot?start=')
  expect(configured).not.toContain('https://t.me/tilchiuz_bot')
  const unavailable = renderToStaticMarkup(
    createElement(LandingPage, { locale: 'uz', botUsername: null }),
  )
  expect(unavailable).not.toContain('https://t.me/')
})
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

  it('points every aria-labelledby at an existing h2/h1', () => {
    const ids = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(
      (m) => m[1] as string,
    )
    expect(ids.length).toBeGreaterThan(5)
    for (const id of ids) {
      expect(html).toMatch(new RegExp(`<h[12] id="${id}"`))
    }
  })

  it('orders each stat term before its value', () => {
    expect(html).toMatch(/<dt>IELTS<\/dt><dd class="stat">/)
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
