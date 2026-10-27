import {
  Children,
  type ReactElement,
  type ReactNode,
  createRef,
  isValidElement,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SignInState } from '../lib/handoff'
import { copy } from '../lib/i18n'
import { escapeHtml as esc } from '../testing/html'
import { SignInView } from './sign-in'

const link = 'https://t.me/tilchiuz_bot?start=login_abc'

type Anchor = ReactElement<{ ref?: unknown; children?: ReactNode }>

// Static markup carries no refs, so look for the link in the element tree.
function anchors(node: ReactNode): Anchor[] {
  if (!isValidElement<Anchor['props']>(node)) return []
  return [
    ...(node.type === 'a' ? [node as Anchor] : []),
    ...Children.toArray(node.props.children).flatMap(anchors),
  ]
}

function render(state: SignInState, locale: keyof typeof copy = 'uz') {
  return renderToStaticMarkup(
    <SignInView state={state} copy={copy[locale]} onStart={() => {}} />,
  )
}

describe('SignInView', () => {
  it('offers the start button and the hint before anything began', () => {
    const html = render({ phase: 'idle' })
    expect(html).toContain('<button')
    expect(html).not.toContain('disabled')
    expect(html).toContain(esc(copy.uz.signInTitle))
    expect(html).toContain(esc(copy.uz.signInButton))
    expect(html).toContain(esc(copy.uz.signInHint))
    expect(html).not.toContain('class="handoff"')
  })

  it('disables the button and marks it busy while the handoff starts', () => {
    const html = render({ phase: 'starting' })
    expect(html).toContain('disabled')
    expect(html).toContain('aria-busy="true"')
  })

  it('replaces the button with the Telegram link while waiting', () => {
    const html = render({ phase: 'waiting', deepLink: link })
    expect(html).not.toContain('<button')
    expect(html).toContain(`href="${link}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener"')
    expect(html).toContain(esc(copy.uz.waiting))
  })

  it('hands the link to its owner so focus can follow the button it replaced', () => {
    const linkRef = createRef<HTMLAnchorElement>()
    const tree = SignInView({
      state: { phase: 'waiting', deepLink: link },
      copy: copy.uz,
      onStart: () => {},
      linkRef,
    })
    const found = anchors(tree)
    expect(found).toHaveLength(1)
    expect(found[0].props.ref).toBe(linkRef)
  })

  it('says the link expired and offers a new attempt', () => {
    const html = render({ phase: 'expired' })
    expect(html).toContain(esc(copy.uz.expired))
    expect(html).toContain(esc(copy.uz.retry))
    expect(html).not.toContain('disabled')
    expect(html).not.toContain('role="alert"')
  })

  it('announces a failed sign-in as an alert and offers a new attempt', () => {
    const html = render({ phase: 'failed' })
    expect(html).toContain('role="alert"')
    expect(html).toContain(esc(copy.uz.signInError))
    expect(html).toContain(esc(copy.uz.retry))
    expect(html).not.toContain('disabled')
  })

  it('locks the button once the bot confirmed', () => {
    const html = render({ phase: 'confirmed' })
    expect(html).toContain(esc(copy.uz.confirmed))
    expect(html).toContain('disabled')
  })

  it('reads in every language without a missing string', () => {
    const states: SignInState[] = [
      { phase: 'idle' },
      { phase: 'starting' },
      { phase: 'waiting', deepLink: link },
      { phase: 'expired' },
      { phase: 'confirmed' },
      { phase: 'failed' },
    ]
    for (const locale of ['uz', 'ru', 'en'] as const) {
      for (const state of states) {
        expect(render(state, locale)).not.toContain('undefined')
      }
    }
    expect(render({ phase: 'expired' }, 'ru')).toContain(esc(copy.ru.expired))
    expect(render({ phase: 'expired' }, 'en')).toContain(esc(copy.en.expired))
  })
})
