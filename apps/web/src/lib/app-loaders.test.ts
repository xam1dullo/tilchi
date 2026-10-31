import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route as Groups } from '../routes/app/index'
import { Route as Assignments } from '../routes/app/assignments'
import { Route as Courses } from '../routes/app/courses'
import { Route as Notifications } from '../routes/app/notifications'
import { Route as Group } from '../routes/app/groups/$groupId'
import { Route as Tests } from '../routes/app/tests/index'
import { Route as Test } from '../routes/app/tests/$testId'
import { Route as Attempt } from '../routes/app/attempts/$attemptId'
import { Route as Meet } from '../routes/app/meet/$lessonId'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppNotFound } from '../routes/app'
import { messages } from './i18n'
import { isNotFound } from '@tanstack/react-router'
import type { SessionUser } from './session'

const view = vi.hoisted(() => ({ session: null as SessionUser | null }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouteContext: ({ from }: { from: string }) =>
    from === '__root__'
      ? { locale: 'en' }
      : { session: view.session, previewRole: 'teacher' },
  Link: ({
    to,
    children,
  }: {
    to: string
    children: import('react').ReactNode
  }) => createElement('a', { href: to }, children),
}))

// Use the browser cookie branch; no Start request scope is needed in Node tests.
vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({
    server: () => ({ client: (fn: unknown) => fn }),
  }),
}))

// Exercise the real API client without an SSR request scope.
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeader: () => undefined,
}))

afterEach(() => vi.unstubAllGlobals())

const routes = [
  { name: 'groups', route: Groups },
  { name: 'assignments', route: Assignments },
  { name: 'courses', route: Courses },
  { name: 'notifications', route: Notifications },
  { name: 'group', route: Group },
  { name: 'tests', route: Tests },
  { name: 'test', route: Test },
  { name: 'attempt', route: Attempt },
  { name: 'meet', route: Meet },
]
type LoaderArgs = {
  context: { session: SessionUser | null; previewRole: 'teacher' | null }
  params: Record<string, string>
}
function load(
  route: (typeof routes)[number]['route'],
  session: SessionUser | null,
  id = 'not-a-real-id',
) {
  const loader = route.options.loader as (args: LoaderArgs) => Promise<unknown>
  return loader({
    context: { session, previewRole: null },
    params: { groupId: id, testId: id, attemptId: id, lessonId: id },
  })
}
const session: SessionUser = { userId: 'u-1', role: 'learner' }

describe('app child loaders', () => {
  it.each(routes)(
    'skips API requests while signed out: $name',
    async ({ route }) => {
      const fetch = vi.fn(async () => new Response('{}', { status: 401 }))
      vi.stubGlobal('fetch', fetch)
      await expect(load(route, null)).resolves.toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it.each(routes)(
    'preserves signed-in API errors: $name',
    async ({ route }) => {
      const fetch = vi.fn(async () => new Response('{}', { status: 401 }))
      vi.stubGlobal('fetch', fetch)
      await expect(
        load(route, { ...session, role: 'admin' }),
      ).rejects.toMatchObject({ status: 401 })
      expect(fetch).toHaveBeenCalled()
    },
  )

  it.each([
    {
      route: Groups,
      path: '/api/groups',
      body: { groups: [], can: { createGroup: false, assignTeacher: false } },
      expected: {
        groups: [],
        can: { createGroup: false, assignTeacher: false },
        teachers: [],
      },
    },
    {
      route: Assignments,
      path: '/api/me/assignments',
      body: { assignments: [] },
      expected: { assignments: [] },
    },
  ])(
    'loads signed-in data from $path',
    async ({ route, path, body, expected }) => {
      const fetch = vi.fn(
        async () => new Response(JSON.stringify(body), { status: 200 }),
      )
      vi.stubGlobal('fetch', fetch)
      await expect(load(route, session)).resolves.toEqual(expected)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(path),
        expect.any(Object),
      )
    },
  )
})

const details = [Group, Test, Attempt, Meet]
describe('unknown app detail IDs', () => {
  it.each(
    details.flatMap((route) => [400, 404].map((status) => ({ route, status }))),
  )('turns API $status into router not-found', async ({ route, status }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/groups')
          ? new Response(JSON.stringify({ can: { manageTests: true } }))
          : new Response('{}', { status }),
      ),
    )
    await expect(
      load(
        route,
        session,
        status === 400
          ? 'not-a-real-id'
          : '00000000-0000-4000-8000-000000000000',
      ),
    ).rejects.toSatisfy(isNotFound)
  })
})

describe('detail errors that are not missing resources', () => {
  it.each(
    details.flatMap((route) =>
      [401, 403, 500].map((status) => ({ route, status })),
    ),
  )('preserves API $status', async ({ route, status }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/api/groups')
          ? new Response(JSON.stringify({ can: { manageTests: true } }))
          : new Response('{}', { status }),
      ),
    )
    await expect(load(route, session)).rejects.toMatchObject({ status })
  })
})

describe('group secondary failures', () => {
  it.each(['lessons', 'members'])(
    'preserves a secondary %s 400',
    async (secondary) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.endsWith(`/api/groups/not-a-real-id/${secondary}`))
            return new Response('{}', { status: 400 })
          if (url.endsWith('/api/groups/not-a-real-id'))
            return Response.json({
              id: 'not-a-real-id',
              can: { seeMembers: true, assignTest: true, seeAssignments: true },
            })
          return Response.json({
            lessons: [],
            members: [],
            tests: [],
            assignments: [],
          })
        }),
      )
      await expect(load(Group, session)).rejects.toMatchObject({ status: 400 })
    },
  )
})

describe('app not-found view', () => {
  it('focuses its level-one heading when mounted', () => {
    view.session = session
    const heading = AppNotFound().props.children[0]
    expect(heading.type).toBe('h1')
    expect(heading.props.tabIndex).toBe(-1)
    const node = { focus: vi.fn() }
    heading.props.ref(node)
    expect(node.focus).toHaveBeenCalledOnce()
    expect(() => heading.props.ref(null)).not.toThrow()
  })

  it.each([
    { role: 'learner', to: '/app/assignments', label: 'myTests' },
    { role: 'teacher', to: '/app/tests', label: 'tests' },
    { role: 'admin', to: '/app/tests', label: 'tests' },
  ] as const)('offers the $role fallback', ({ role, to, label }) => {
    view.session = { ...session, role }
    const html = renderToStaticMarkup(createElement(AppNotFound))
    expect(html).toContain(messages('en').pageNotFound)
    expect(html).toContain(`href="${to}"`)
    expect(html).toContain(messages('en')[label])
  })
})
