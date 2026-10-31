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
import type { SessionUser } from './session'

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
) {
  const loader = route.options.loader as (args: LoaderArgs) => Promise<unknown>
  return loader({
    context: { session, previewRole: null },
    params: { groupId: 'g1', testId: 't1', attemptId: 'a1', lessonId: 'l1' },
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
