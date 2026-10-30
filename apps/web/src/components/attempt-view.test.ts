import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { MyAssignment } from '../lib/attempt'
import { messages } from '../lib/i18n'
import { AttemptQuestionView, AttemptSummary } from './attempt-view'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
}))
const { MyTestsList } = await import('./my-tests')

const copy = messages('en')
const options = [
  { id: 'a', text: 'Apple' },
  { id: 'b', text: 'Banana' },
]

describe('AttemptQuestionView', () => {
  const render = (type: 'single' | 'multi', result?: object) =>
    renderToStaticMarkup(
      createElement(AttemptQuestionView, {
        copy,
        question: { id: 'q', type, prompt: 'Pick', options, ...result },
        picked: ['b'],
        onPick: () => {},
      }),
    )

  it('uses radios for single and checkboxes for multi, keeping the pick', () => {
    expect(render('single')).toContain('type="radio"')
    expect(render('multi')).toContain('type="checkbox"')
    expect(render('single')).toContain('checked="" value="b"')
    expect(render('single')).not.toContain('checked="" value="a"')
  })

  it('shows points only once graded', () => {
    expect(render('single')).not.toContain(copy.attemptScore)
    expect(render('single', { result: { points: 1, max: 1 } })).toContain(
      '<span class="num">1 / 1</span>',
    )
  })
})

describe('AttemptSummary', () => {
  const render = (status: 'assigned' | 'submitted' | 'graded') =>
    renderToStaticMarkup(
      createElement(AttemptSummary, {
        copy,
        attempt: { status, score: 5, maxScore: 7, feedback: 'Good' },
      }),
    )
  it('says awaiting grade, then the score and feedback', () => {
    expect(render('assigned')).toBe('')
    expect(render('submitted')).toContain(copy.attemptAwaitingGrade)
    expect(render('graded')).toContain('5 / 7')
    expect(render('graded')).toContain('Good')
  })
})

describe('MyTestsList', () => {
  const row = {
    attemptId: 'x',
    assignmentId: 'a',
    groupId: 'g',
    groupName: 'Morning B1',
    title: 'Unit 1',
    deadline: '2030-01-02T04:30:00.000Z',
    submittedAt: null,
  }
  const render = (assignments: MyAssignment[]) =>
    renderToStaticMarkup(
      createElement(MyTestsList, {
        assignments,
        copy,
        locale: 'en',
        previewRole: null,
      }),
    )

  it('lists title, group, Tashkent deadline, status, and score once graded', () => {
    const html = render([
      { ...row, status: 'assigned', score: null },
      { ...row, attemptId: 'y', status: 'graded', score: 6 },
    ] satisfies MyAssignment[])
    expect(html).toContain('Unit 1')
    expect(html).toContain('Morning B1')
    expect(html).toContain('9:30')
    expect(html).toContain(copy.attemptAssigned)
    expect(html).toContain('<span class="num">6</span>')
  })

  it('says so when nothing is assigned', () => {
    expect(render([])).toContain(copy.myTestsEmpty)
  })
})
