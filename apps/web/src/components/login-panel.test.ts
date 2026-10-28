import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { messages } from '../lib/i18n'
import type { FailureReason, LoginState } from '../lib/login-flow'
import { locales, type Locale } from '../lib/locale'
import { LoginPanel } from './login-panel'

const LINK = 'https://t.me/tilchiuz_bot?start=abc'
const reasons: FailureReason[] = [
  'expired',
  'rejected',
  'rate_limited',
  'network',
  'unavailable',
]

function render(state: LoginState, locale: Locale = 'en', onBegin = () => {}) {
  return renderToStaticMarkup(
    createElement(LoginPanel, { state, copy: messages(locale), onBegin }),
  )
}

/** The same escaping React applies to text, so uz apostrophes compare equal. */
function escaped(text: string) {
  return renderToStaticMarkup(createElement('i', null, text)).slice(3, -4)
}

function elements(node: ReactNode, found: ReactNode[] = []): ReactNode[] {
  if (Array.isArray(node)) {
    for (const child of node) elements(child, found)
  } else if (isValidElement<{ children?: ReactNode }>(node)) {
    found.push(node)
    elements(node.props.children, found)
  }
  return found
}

describe('LoginPanel', () => {
  it('offers the Telegram sign-in button in idle', () => {
    const html = render({ kind: 'idle' })
    expect(html).toContain('<h1>Sign in with Telegram</h1>')
    expect(html).toContain('Continue in Telegram')
    expect(html).toContain('The Telegram app will open')
    expect(html).toContain('aria-busy="false"')
    expect(html).not.toContain('disabled')
  })

  it('disables the button while the handoff is being created', () => {
    const html = render({ kind: 'starting' })
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Continue in Telegram')
  })

  it('shows that Telegram is being checked inside a Mini App', () => {
    const html = render({ kind: 'verifying' })
    expect(html).toContain('Checking your Telegram sign-in.')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain('<button')
  })

  it('waits for the confirmation and keeps the Telegram link to hand', () => {
    const html = render({ kind: 'waiting', deepLink: LINK, strikes: 0 })
    expect(html).toContain(
      'Waiting for confirmation. The link lasts 5 minutes.',
    )
    expect(html).toContain('role="status"')
    expect(html).toContain(`href="${LINK}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener"')
    expect(html).toContain('Open Telegram')
    expect(html).toContain('aria-busy="false"')
    expect(html).not.toContain('<button')
  })

  it('says the sign-in is confirmed', () => {
    const html = render({ kind: 'confirmed' })
    expect(html).toContain('Sign-in confirmed.')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('<button')
  })

  it.each(locales)(
    'shows a distinct message and a retry button for every failure in %s',
    (locale) => {
      const copy = messages(locale)
      const seen = new Set<string>()
      for (const reason of reasons) {
        const html = render({ kind: 'failed', reason }, locale)
        const message = /role="alert">([^<]*)</.exec(html)?.[1]
        expect(message).toBeTruthy()
        expect(message).not.toContain('undefined')
        seen.add(message ?? '')
        expect(html).toContain(`>${escaped(copy.retry)}</button>`)
        expect(html).not.toContain('Continue in Telegram')
      }
      expect(seen.size).toBe(reasons.length)
    },
  )

  it('uses the existing copy for an expired link', () => {
    const html = render({ kind: 'failed', reason: 'expired' }, 'uz')
    expect(html).toContain(escaped(messages('uz').expired))
  })

  it('names rate limiting, network trouble and a rejected sign-in', () => {
    expect(render({ kind: 'failed', reason: 'rate_limited' })).toContain(
      'Too many attempts. Try again in a minute.',
    )
    expect(render({ kind: 'failed', reason: 'network' })).toContain(
      'Cannot reach the server.',
    )
    expect(render({ kind: 'failed', reason: 'rejected' })).toContain(
      'Telegram did not accept the sign-in.',
    )
    expect(render({ kind: 'failed', reason: 'unavailable' })).toContain(
      'Sign-in is unavailable right now.',
    )
  })

  it('renders every state in Uzbek and Russian without a missing string', () => {
    const states: LoginState[] = [
      { kind: 'idle' },
      { kind: 'starting' },
      { kind: 'verifying' },
      { kind: 'waiting', deepLink: LINK, strikes: 1 },
      { kind: 'confirmed' },
      ...reasons.map((reason) => ({ kind: 'failed', reason }) as const),
    ]
    for (const locale of ['uz', 'ru'] as const) {
      for (const state of states) {
        const html = render(state, locale)
        expect(html).not.toContain('undefined')
        expect(html).not.toContain('></p>')
      }
    }
  })

  it('calls onBegin from the sign-in button and from the retry button', () => {
    const copy = messages('en')
    for (const [state, label] of [
      [{ kind: 'idle' }, copy.signInButton],
      [{ kind: 'failed', reason: 'network' }, copy.retry],
    ] as const) {
      const onBegin = vi.fn()
      const tree = LoginPanel({ state, copy, onBegin })
      const button = elements(tree).find(
        (node) =>
          isValidElement<{ onClick?: () => void; children?: ReactNode }>(
            node,
          ) && node.type === 'button',
      )
      expect(button).toBeDefined()
      if (isValidElement<{ onClick?: () => void }>(button)) {
        button.props.onClick?.()
      }
      expect(onBegin, label).toHaveBeenCalledTimes(1)
    }
  })
})
