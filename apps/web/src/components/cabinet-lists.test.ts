import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assignmentView } from '../lib/cabinet'
import type { MyAssignment } from '../lib/attempt'
import type { AppRole } from '../lib/nav'
import { messages } from '../lib/i18n'

const state = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  role: 'teacher' as AppRole,
  previewRole: 'teacher' as AppRole | null,
}))
afterEach(() => {
  state.data = {}
  state.role = 'teacher'
  state.previewRole = 'teacher'
})
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => ({ kind: 'authenticated', ...state.data }),
  }),
  useRouteContext: () => ({
    locale: 'en',
    session: { role: state.role },
    previewRole: state.previewRole,
  }),
  useRouter: () => ({}),
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: {
    children: ReactNode
    to: string
    params: Record<string, string>
    search?: { preview?: AppRole }
  }) =>
    createElement(
      'a',
      {
        ...props,
        href:
          to.replace(/\$\w+/, (key) => params[key.slice(1)]) +
          (search?.preview ? `?preview=${search.preview}` : ''),
      },
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
      previewRole: 'learner',
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
  it('counts loaded assignments and filters each status without changing the source', () => {
    const rows = ['assigned', 'assigned', 'submitted', 'graded', 'missed'].map(
      (status, i) => assignment(status as MyAssignment['status'], i),
    )
    const counts = { all: 5, assigned: 2, submitted: 1, graded: 1, missed: 1 }
    for (const filter of [
      'all',
      'assigned',
      'submitted',
      'graded',
      'missed',
    ] as const) {
      const view = assignmentView(rows, filter)
      expect(view.counts).toEqual(counts)
      expect(view.rows).toEqual(
        filter === 'all' ? rows : rows.filter((row) => row.status === filter),
      )
    }
    expect(rows).toHaveLength(5)
    expect(assignmentView([], 'all')).toEqual({
      counts: { all: 0, assigned: 0, submitted: 0, graded: 0, missed: 0 },
      rows: [],
    })
    expect(assignmentView([assignment('assigned', 0)], 'graded').rows).toEqual(
      [],
    )
  })
  it('renders five counted filter buttons with All pressed by default', () => {
    const html = render([assignment('assigned', 0), assignment('submitted', 1)])
    expect(html).toContain(
      '<fieldset class="assignment-filters" aria-label="Filter assignments"',
    )
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(4)
    expect(html).toContain(
      'aria-pressed="true" aria-label="All: 2">All <span class="assignment-filter-count">2</span>',
    )
    expect(html).toContain('aria-label="Submitted: 1"')
    expect(html.match(/<li /g)).toHaveLength(2)
  })
  it('counts each status separately and retains status, zero grade and attempt link', () => {
    const html = render(
      ['assigned', 'assigned', 'submitted', 'graded', 'missed'].map((s, i) =>
        assignment(s as MyAssignment['status'], i),
      ),
    )
    expect(html).toContain('<dt>Assigned</dt><dd>2</dd>')
    for (const label of ['Submitted', 'Graded', 'Missed'])
      expect(html).toContain(`<dt>${label}</dt><dd>1</dd>`)
    expect(html).toContain('href="/app/attempts/a3?preview=learner"')
    expect(html).toContain('<span class="tag">Graded</span>')
    expect(html).toContain('class="num">0</span>')
    for (const hint of [
      copy.cabinetAssignedHint,
      copy.cabinetSubmittedHint,
      copy.cabinetGradedHint,
      copy.cabinetMissedHint,
    ])
      expect(html).toContain(hint)
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
    expect(html).toContain('href="/app/groups/g?preview=teacher"')
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
      ['Published questions', 1],
      ['Draft questions', 1],
    ])
      expect(html).toContain(`<dt>${label}</dt><dd>${number}</dd>`)
    expect(html).toContain('href="/app/tests/t?preview=teacher"')
    expect(html).toContain('Questions: 2')
    for (const hint of [
      'Tests available to assign',
      'Across the question bank',
      'Questions ready to use',
      'Questions in progress',
    ])
      expect(html).toContain(hint)
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

describe('role-specific group statistics', () => {
  it.each(['learner', 'teacher', 'admin'] as const)(
    'shows appropriate cards and hints for %s from the session',
    (role) => {
      state.role = role
      state.previewRole = null
      state.data = { groups: [], can: {}, teachers: [] }
      const html = page(GroupsRoute)
      expect(html.match(/<dt>/g)).toHaveLength(role === 'learner' ? 2 : 4)
      expect(html.includes('<dt>Learner places</dt>')).toBe(role !== 'learner')
      expect(html.includes('<dt>Available places</dt>')).toBe(
        role !== 'learner',
      )
      expect(html).toContain(
        role === 'admin' ? 'Across all groups' : 'Across your groups',
      )
      if (role === 'admin') expect(html).not.toContain('Across your groups')
    },
  )
})
