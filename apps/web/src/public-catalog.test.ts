import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PublicCatalog } from './components/public-catalog'
import type { CourseRecord } from './lib/catalog'
import { messages } from './lib/i18n'

const course: CourseRecord = {
  id: '1',
  title: 'IELTS',
  description: 'Ingliz tili',
  segment: 'ielts',
  level: 'orta',
  published: true,
  createdAt: '',
  updatedAt: '',
}

describe('public catalog', () => {
  it('shows published courses with a configured Telegram registration link', () => {
    const html = renderToStaticMarkup(
      createElement(PublicCatalog, {
        courses: [
          course,
          { ...course, id: '2', title: 'Private draft', published: false },
        ],
        botUsername: 'deno_blogbot',
        copy: messages('uz'),
      }),
    )
    expect(html).toContain('IELTS')
    expect(html).toContain('https://t.me/deno_blogbot?start=ielts_orta')
    expect(html).not.toContain('Private draft')
  })

  it('shows the empty state and never invents a Telegram destination', () => {
    const empty = renderToStaticMarkup(
      createElement(PublicCatalog, {
        courses: [],
        botUsername: null,
        copy: messages('uz'),
      }),
    )
    expect(empty).toContain(messages('uz').catalogEmpty)
    const unavailable = renderToStaticMarkup(
      createElement(PublicCatalog, {
        courses: [course],
        botUsername: null,
        copy: messages('uz'),
      }),
    )
    expect(unavailable).toContain(messages('uz').catalogNoTelegram)
    expect(unavailable).not.toContain('https://t.me/')
  })
})
