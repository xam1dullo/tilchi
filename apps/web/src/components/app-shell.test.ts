import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'learner' }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useRouteContext: () => ({
      session: { role: state.role, userId: 'test-user' },
      previewRole: null,
    }),
  }),
  useRouteContext: () => ({ locale: 'en' }),
  useNavigate: () => vi.fn(),
  Outlet: () => null,
  Link: ({
    children,
    to,
    className,
    activeProps,
  }: {
    children: ReactNode
    to: string
    className?: string
    activeProps?: Record<string, string>
  }) =>
    createElement(
      'a',
      {
        href: to,
        className,
        ...(to === '/app' ? activeProps : {}),
      },
      children,
    ),
}))
const { Route } = await import('../routes/app')
const render = () =>
  renderToStaticMarkup(
    createElement(Route.options.component as () => ReactNode),
  )

describe('app sidebar shell', () => {
  it.each([
    ['learner', ['/app', '/app/assignments', '/app/notifications']],
    ['teacher', ['/app', '/app/tests', '/app/notifications']],
    ['admin', ['/app', '/app/courses', '/app/tests', '/app/notifications']],
  ] as const)(
    'groups navigation while preserving %s links and mobile navigation',
    (role, paths) => {
      state.role = role
      const html = render()
      const desktop =
        html.match(/<nav class="app-nav"[\s\S]*?<\/nav>/)?.[0] ?? ''
      const mobile =
        html.match(/<nav class="app-sheet"[\s\S]*?<\/nav>/)?.[0] ?? ''
      expect(html).toContain('class="app-sidebar"')
      expect(desktop).toContain('Learning')
      expect(desktop).toContain('Updates')
      expect(desktop).toContain('aria-label="Main navigation"')
      expect(desktop).toContain('href="/app" aria-current="page"')
      expect(desktop.match(/href=/g)).toHaveLength(paths.length)
      expect(mobile.match(/href=/g)).toHaveLength(paths.length)
      for (const path of paths) {
        expect(desktop).toContain(`href="${path}"`)
        expect(mobile).toContain(`href="${path}"`)
      }
    },
  )
})
