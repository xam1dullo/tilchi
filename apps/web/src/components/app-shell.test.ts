import { readFileSync } from 'node:fs'
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
  }: {
    children: ReactNode
    to: string
    className?: string
  }) =>
    createElement(
      'a',
      {
        href: to,
        className,
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
      expect(html).toContain('<div class="app-sidebar">')
      expect(desktop).toContain('Learning')
      expect(desktop).toContain('Updates')
      expect(desktop).toContain('aria-label="Main navigation"')
      // Active state belongs to the real router; this mock only renders links.
      expect(
        readFileSync(new URL('../routes/app.tsx', import.meta.url), 'utf8'),
      ).not.toContain('activeProps=')
      expect(desktop.match(/href=/g)).toHaveLength(paths.length)
      expect(mobile.match(/href=/g)).toHaveLength(paths.length)
      for (const path of paths) {
        expect(desktop).toContain(`href="${path}"`)
        expect(mobile).toContain(`href="${path}"`)
      }
    },
  )
})

const shellCss = readFileSync(
  new URL('../styles/app-shell.css', import.meta.url),
  'utf8',
)
const classroomCss = readFileSync(
  new URL('../styles/classroom.css', import.meta.url),
  'utf8',
)

describe('sidebar layout constraints', () => {
  it('draws every desktop sidebar link focus ring inside its scroll clip', () => {
    expect(shellCss).toMatch(
      /\.app-shell \.app-sidebar a:focus-visible\s*\{[^}]*outline: 2px solid var\(--bg\);[^}]*outline-offset: -2px;/,
    )
  })
})

it('expands grade and attempt columns only when their page has room', () => {
  expect(classroomCss).toMatch(
    /:is\(\.attempt-page, \.grade-page\)\s*\{[^}]*container: assessment \/ inline-size;/,
  )
  expect(classroomCss).toContain('@container assessment (min-width: 780px)')
  expect(classroomCss).not.toMatch(/@media \(min-width: 780px\)/)
})

it('stretches the intermediate sidebar divider for the full shell height', () => {
  expect(shellCss).toMatch(
    /\.app-sidebar\s*\{[^}]*border-right: 1px solid var\(--line\);/,
  )
  expect(shellCss).toMatch(
    /\.app-shell \.app-sidebar\s*\{[^}]*border-right: 0;/,
  )
})
