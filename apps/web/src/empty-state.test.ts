import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { locales } from './lib/locale'
import { messages } from './lib/i18n'
import { EmptyGroups } from './routes/app/index'

function escaped(text: string) {
  return renderToStaticMarkup(createElement('i', null, text)).slice(3, -4)
}

describe('EmptyGroups (a learner with no Group, story 58)', () => {
  it('uses the configured bot and hides the action when config is unavailable', () => {
    const copy = messages('uz')
    const configured = renderToStaticMarkup(
      createElement(EmptyGroups, { copy, botUsername: 'deno_blogbot' }),
    )
    expect(configured).toContain('https://t.me/deno_blogbot')
    const unavailable = renderToStaticMarkup(
      createElement(EmptyGroups, { copy, botUsername: null }),
    )
    expect(unavailable).not.toContain('https://t.me/')
  })
  it.each(locales)(
    'points the course CTA at the landing courses section in %s',
    (locale) => {
      const copy = messages(locale)
      const html = renderToStaticMarkup(createElement(EmptyGroups, { copy }))
      expect(html).toContain(escaped(copy.emptyBody))
      expect(html).toContain(
        `<a class="btn btn-primary" href="/#programs">${escaped(copy.catalog)}</a>`,
      )
      expect(html).not.toContain('href="/"')
    },
  )

  it('keeps Telegram as the secondary action', () => {
    const copy = messages('en')
    const html = renderToStaticMarkup(createElement(EmptyGroups, { copy }))
    expect(html).toContain(
      `<a class="btn btn-outline" href="https://t.me/tilchiuz_bot" target="_blank" rel="noopener">${copy.telegramWrite}</a>`,
    )
    expect(html.indexOf('btn-primary')).toBeLessThan(
      html.indexOf('btn-outline'),
    )
  })
})
