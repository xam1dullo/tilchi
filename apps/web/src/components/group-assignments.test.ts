import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AssignmentRecord } from '../lib/assignments'
import { messages } from '../lib/i18n'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
  }: {
    children: unknown
    params: { attemptId: string }
  }) =>
    createElement(
      'a',
      { href: `/app/attempts/${params.attemptId}` },
      children as string,
    ),
  useRouter: () => ({}),
}))
const { AssignmentsList } = await import('./group-assignments')

const copy = messages('en')
const render = (assignments: AssignmentRecord[], canGrade = false) =>
  renderToStaticMarkup(
    createElement(AssignmentsList, {
      assignments,
      copy,
      locale: 'en',
      canGrade,
      previewRole: null,
    }),
  )
const one: AssignmentRecord = {
  id: 'a',
  testId: 't',
  title: 'T',
  deadline: '',
  attempts: [
    {
      id: 'x9',
      userId: 'u',
      name: 'Aziz',
      status: 'submitted',
      score: null,
      submittedAt: null,
    },
  ],
}

describe('AssignmentsList', () => {
  it('shows counts per status and each learner without links', () => {
    const html = render([
      {
        id: 'a1',
        testId: 't1',
        title: 'Unit 1',
        deadline: '2030-01-02T04:30:00.000Z',
        attempts: [
          {
            id: 'x1',
            userId: 'u1',
            name: 'Aziz',
            status: 'graded',
            score: 7,
            submittedAt: '2030-01-01T06:00:00.000Z',
          },
          {
            id: 'x2',
            userId: 'abcdef1234',
            name: null,
            status: 'assigned',
            score: null,
            submittedAt: null,
          },
        ],
      },
    ])
    expect(html).toContain('Unit 1')
    expect(html).toContain('Assigned: <span class="num">1</span>')
    expect(html).toContain('Graded: <span class="num">1</span>')
    expect(html).toContain('Missed: <span class="num">0</span>')
    expect(html).toContain('<th scope="row">Aziz</th>')
    expect(html).toContain('<th scope="row">abcdef12</th>')
    expect(html).toContain('<td class="num">7</td>')
    expect(html).toContain('Learners (2)')
    expect(html).not.toContain('<a ')
  })

  it('says so when there are no assignments or no learners', () => {
    expect(render([])).toContain(copy.assignmentsEmpty)
    const html = render([
      { id: 'a', testId: 't', title: 'T', deadline: '', attempts: [] },
    ])
    expect(html).toContain(copy.attemptNoLearners)
    expect(html).not.toContain('<details')
  })

  it('links each learner to the attempt only when the server allows grading', () => {
    expect(render([one], true)).toContain(
      '<th scope="row"><a href="/app/attempts/x9">Aziz</a></th>',
    )
    expect(render([one], false)).not.toContain('<a ')
  })
})
