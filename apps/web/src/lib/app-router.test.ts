import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { Route as App } from '../routes/app'
import { Route as Groups } from '../routes/app/index'
import { Route as Group } from '../routes/app/groups/$groupId'
import { Route as Test } from '../routes/app/tests/$testId'
import { Route as Attempt } from '../routes/app/attempts/$attemptId'
import { Route as Meet } from '../routes/app/meet/$lessonId'
import { messages } from './i18n'
import type { SessionUser } from './session'

vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({
    server: () => ({ client: (fn: unknown) => fn }),
  }),
}))
afterEach(() => vi.unstubAllGlobals())

async function render(path: string, session: SessionUser | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/api/groups')
        ? Response.json({ can: { manageTests: true } })
        : new Response('{}', { status: 404 }),
    ),
  )
  const root = createRootRoute({
    beforeLoad: () => ({ locale: 'en' as const, botUsername: null }),
    component: Outlet,
  })
  const app = App.update({
    getParentRoute: () => root,
    id: '/app',
    path: '/app',
    beforeLoad: () => ({ session, previewRole: null }),
  } as never)
  const children = [
    [Groups, '/'],
    [Group, 'groups/$groupId'],
    [Test, 'tests/$testId'],
    [Attempt, 'attempts/$attemptId'],
    [Meet, 'meet/$lessonId'],
  ] as const
  const routeTree = root.addChildren([
    app.addChildren(
      children.map(([route, path]) =>
        route.update({
          getParentRoute: () => app,
          id: `/${path}`,
          path,
        } as never),
      ),
    ),
  ])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: true,
  })
  await router.load()
  return {
    html: renderToString(createElement(RouterProvider, { router })),
    notFound: router.state.matches.some((match) => match.status === 'notFound'),
  }
}

describe('detail boundaries within the actual router shell', () => {
  it.each(['groups', 'tests', 'attempts', 'meet'])(
    'keeps the shell around missing %s',
    async (segment) => {
      const { html, notFound } = await render(`/app/${segment}/unknown`, {
        userId: 'u-1',
        role: 'teacher',
      })
      expect(notFound).toBe(true)
      expect(html).toMatch(/class="app-shell"/)
      expect(html).toContain('class="app-topbar"')
      expect(html).toContain(messages('en').logout)
      expect(html).toMatch(
        /class="app-main">[\s\S]*<h1[^>]*tabindex="-1"[^>]*>Page not found/,
      )
      expect(html).toContain('href="/app/tests"')
    },
  )
  it.each(['/app', '/app/groups/unknown'])(
    'renders sign-in without a not-found match at %s',
    async (path) => {
      const { html, notFound } = await render(path, null)
      expect(notFound).toBe(false)
      expect(html).toContain(messages('en').signInTitle)
      expect(html).not.toContain('class="app-shell"')
    },
  )
})
