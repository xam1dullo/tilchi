import {
  Children,
  type ReactElement,
  type ReactNode,
  isValidElement,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { apiFailure } from '../lib/http-failure'
import { copy } from '../lib/i18n'
import { escapeHtml as esc } from '../testing/html'
import { ForbiddenView, LoadErrorView, SkeletonRows } from './async-states'

type Pressable = ReactElement<{ children?: ReactNode; onClick?: () => void }>

// Static markup cannot press anything, so look for the buttons in the element tree.
function buttons(node: ReactNode): Pressable[] {
  if (!isValidElement<Pressable['props']>(node)) return []
  return [
    ...(node.type === 'button' ? [node as Pressable] : []),
    ...Children.toArray(node.props.children).flatMap(buttons),
  ]
}

describe('LoadErrorView', () => {
  it('shows an error row with a retry button for an ordinary failure', () => {
    for (const error of [
      apiFailure(500),
      apiFailure(401),
      new Error('fetch failed'),
    ]) {
      const html = renderToStaticMarkup(
        <LoadErrorView copy={copy.en} error={error} retry={() => {}} />,
      )
      expect(html).toContain('role="alert"')
      expect(html).toContain(esc(copy.en.error))
      expect(html).toContain(esc(copy.en.retry))
      expect(html).not.toContain('class="forbidden"')
    }
  })

  it('treats anything thrown that is not an Error as an ordinary failure', () => {
    // The router types the error as unknown: a loader may throw a string or an object.
    for (const error of [
      'api_403',
      { message: 'api_403' },
      null,
      undefined,
      42,
    ]) {
      const html = renderToStaticMarkup(
        <LoadErrorView copy={copy.en} error={error} retry={() => {}} />,
      )
      expect(html).toContain('role="alert"')
      expect(html).not.toContain('class="forbidden"')
    }
  })

  it('retries when the button is pressed', () => {
    const retry = vi.fn()
    const found = buttons(
      LoadErrorView({ copy: copy.en, error: apiFailure(500), retry }),
    )

    expect(found).toHaveLength(1)
    found[0]?.props.onClick?.()
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('shows the 403 page, without a retry, when the API said forbidden', () => {
    const html = renderToStaticMarkup(
      <LoadErrorView copy={copy.ru} error={apiFailure(403)} retry={() => {}} />,
    )
    expect(html).toContain('class="forbidden"')
    expect(html).toContain(esc(copy.ru.forbiddenTitle))
    expect(html).toContain(esc(copy.ru.forbiddenBody))
    expect(html).not.toContain('<button')
    expect(html).not.toContain('role="alert"')
  })
})

describe('ForbiddenView', () => {
  it('has one h1 in each language', () => {
    for (const messages of Object.values(copy)) {
      const html = renderToStaticMarkup(<ForbiddenView copy={messages} />)
      expect(html.match(/<h1>/g)).toHaveLength(1)
      expect(html).toContain(esc(messages.forbiddenTitle))
    }
  })
})

describe('SkeletonRows', () => {
  it('is hidden from assistive technology and has three rows', () => {
    const html = renderToStaticMarkup(<SkeletonRows />)
    expect(html).toContain('aria-hidden="true"')
    expect(html.match(/row skeleton/g)).toHaveLength(3)
  })
})
