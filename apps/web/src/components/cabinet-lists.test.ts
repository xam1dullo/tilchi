import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { MyAssignment } from '../lib/attempt'
import { messages } from '../lib/i18n'

const state = vi.hoisted(() => ({ data: {} as Record<string, unknown> }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => ({ kind: 'authenticated', ...state.data }),
  }),
  useRouteContext: () => ({ locale: 'en', previewRole: null }),
  useRouter: () => ({}),
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode
    to: string
    params: Record<string, string>
  }) =>
    createElement(
      'a',
      { ...props, href: to.replace(/\$\w+/, (key) => params[key.slice(1)]) },
      children,
    ),
}))
const { MyTestsList } = await import('./my-tests')
const copy = messages('en')
const render = (assignments: MyAssignment[]) =>
  renderToStaticMarkup(
    createElement(MyTestsList, {
      assignments,
      copy,
      locale: 'en',
      previewRole: null,
    }),
  )
const assignment = (
  status: MyAssignment['status'],
  index: number,
): MyAssignment => ({
  attemptId: `a${index}`,
  assignmentId: 's',
  groupId: 'g',
  groupName: 'Evening',
  title: `Unit ${index}`,
  deadline: '2030-01-01T10:00:00Z',
  status,
  score: status === 'graded' ? 0 : null,
  submittedAt: null,
})

describe('assignment cabinet', () => {
  it('counts each status separately and retains status, zero grade and attempt link', () => {
    const html = render(
      ['assigned', 'assigned', 'submitted', 'graded', 'missed'].map((s, i) =>
        assignment(s as MyAssignment['status'], i),
      ),
    )
    expect(html).toContain('<dt>Assigned</dt><dd>2</dd>')
    for (const label of ['Submitted', 'Graded', 'Missed'])
      expect(html).toContain(`<dt>${label}</dt><dd>1</dd>`)
    expect(html).toContain('href="/app/attempts/a3"')
    expect(html).toContain('<span class="tag">Graded</span>')
    expect(html).toContain('class="num">0</span>')
    expect(html).toContain('Open')
  })
  it('keeps four zero counts and the empty message', () => {
    const html = render([])
    expect(html.match(/<dd>0<\/dd>/g)).toHaveLength(4)
    expect(html).toContain(copy.myTestsEmpty)
    expect(html).not.toContain('<a ')
  })
})

const { Route: GroupsRoute } = await import('../routes/app/index')
const { Route: TestsRoute } = await import('../routes/app/tests/index')
const page = (route: typeof GroupsRoute | typeof TestsRoute) =>
  renderToStaticMarkup(
    createElement(route.options.component as () => ReactNode),
  )

describe('group and test cabinets', () => {
  it('sums group membership and capacity while retaining the group link', () => {
    state.data = {
      groups: [
        { id: 'g', name: 'Evening', learnerCount: 3, capacity: 8, can: {} },
        { id: 'h', name: 'Morning', learnerCount: 2, capacity: 4, can: {} },
      ],
      can: { createGroup: false },
      teachers: [],
    }
    const html = page(GroupsRoute)
    for (const [label, number] of [
      ['Group count', 2],
      ['Members', 5],
      ['Learner places', 12],
      ['Available places', 7],
    ])
      expect(html).toContain(`<dt>${label}</dt><dd>${number}</dd>`)
    expect(html).toContain('href="/app/groups/g"')
    expect(html).toContain('3/8')
    expect(html).toContain('Open')
  })
  it('counts tests and bank question statuses without inventing a test status', () => {
    state.data = {
      tests: [{ id: 't', title: 'Unit 1', questionCount: 2 }],
      questions: [
        { id: 'q', prompt: 'Hello', status: 'published', type: 'speaking' },
        { id: 'r', prompt: 'Draft', status: 'draft', type: 'speaking' },
      ],
    }
    const html = page(TestsRoute)
    for (const [label, number] of [
      ['Test library', 1],
      ['Question count', 2],
      ['Published', 1],
      ['Drafts', 1],
    ])
      expect(html).toContain(`<dt>${label}</dt><dd>${number}</dd>`)
    expect(html).toContain('href="/app/tests/t"')
    expect(html).toContain('Questions: 2')
    expect(html).toContain('Open')
  })
  it('renders zero statistics and existing empty messages for both pages', () => {
    state.data = { groups: [], can: {}, teachers: [] }
    const groups = page(GroupsRoute)
    expect(groups.match(/<dd>0<\/dd>/g)).toHaveLength(4)
    expect(groups).toContain(copy.emptyBody)
    state.data = { tests: [], questions: [] }
    const tests = page(TestsRoute)
    expect(tests.match(/<dd>0<\/dd>/g)).toHaveLength(4)
    expect(tests).toContain(copy.testEmpty)
  })
})
