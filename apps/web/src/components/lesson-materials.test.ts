import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { messages } from '../lib/i18n'
import { MaterialLinks } from './lesson-materials'

const copy = messages('uz')
const render = (lesson: {
  slideUrl: string | null
  canvasUrl: string | null
}) => renderToStaticMarkup(createElement(MaterialLinks, { lesson, copy }))

describe('MaterialLinks', () => {
  it('opens each set link in a new tab without a referrer, and shows nothing otherwise', () => {
    expect(render({ slideUrl: null, canvasUrl: null })).toBe('')
    const html = render({
      slideUrl: 'https://slides.example/1',
      canvasUrl: null,
    })
    expect(html).toContain(copy.materials)
    expect(html).toContain(copy.materialSlide)
    expect(html).not.toContain(copy.materialCanvas)
    expect(html).toMatch(
      /<a href="https:\/\/slides\.example\/1" target="_blank" rel="noopener noreferrer">/,
    )
    expect(
      render({ slideUrl: null, canvasUrl: 'https://b.example' }),
    ).toContain(copy.materialCanvas)
  })
})
