import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LoginScreen } from './login-screen'

describe('LoginScreen', () => {
  it('renders the idle sign-in on the server without touching the browser', () => {
    // No router here: the screen must not need one (or window) to render.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect('window' in globalThis).toBe(false)
    const html = renderToStaticMarkup(
      createElement(LoginScreen, { locale: 'ru' }),
    )
    expect(html).toContain('<h1>Войти через Telegram</h1>')
    expect(html).toContain('Продолжить в Telegram')
    expect(html).toContain('aria-busy="false"')
    vi.restoreAllMocks()
  })
})
