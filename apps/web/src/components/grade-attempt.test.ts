import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AttemptQuestion } from '../lib/attempt'
import { emptyGrade } from '../lib/grading'
import { messages } from '../lib/i18n'

vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({}) }))
const { GradeQuestion } = await import('./grade-attempt')
const { AttemptQuestionView } = await import('./attempt-view')

const copy = messages('en')
const options = [
  { id: 'a', text: 'Apple' },
  { id: 'b', text: 'Banana' },
]
const choice: AttemptQuestion = {
  id: 'q',
  type: 'single',
  prompt: 'Pick',
  options,
  answerKey: ['a'],
  autoCorrect: false,
}
const speaking: AttemptQuestion = {
  id: 'v',
  type: 'speaking',
  prompt: 'Talk',
  options: null,
}

const render = (
  question: AttemptQuestion,
  extra: { recorded?: boolean; editable?: boolean } = {},
) =>
  renderToStaticMarkup(
    createElement(GradeQuestion, {
      copy,
      question,
      answer: ['b'],
      recorded: extra.recorded ?? false,
      editable: extra.editable ?? true,
      busy: false,
      draft: emptyGrade(),
      onChange: () => {},
      player: createElement('span', null, 'PLAYER'),
    }),
  )

describe('GradeQuestion', () => {
  it('shows the learner answer, the key, the auto check and an override', () => {
    const html = render(choice)
    expect(html).toContain(`${copy.gradeLearnerAnswer} Banana`)
    expect(html).toContain(`${copy.gradeCorrectAnswer} Apple`)
    expect(html).toContain(copy.gradeAutoWrong)
    expect(html).toContain(copy.gradeOverrideRight)
    expect(render(choice, { editable: false })).not.toContain('<select')
  })

  it('plays and scores only a recorded speaking answer', () => {
    const html = render(speaking, { recorded: true })
    expect(html).toContain('PLAYER')
    expect(html).toContain('max="5"')
    const missing = render(speaking, { recorded: false })
    expect(missing).toContain(copy.recordMissing)
    expect(missing).not.toContain('PLAYER')
    expect(missing).not.toContain('<input')
  })
})

describe('learner view', () => {
  it('never prints the answer key even if one slipped into the data', () => {
    const html = renderToStaticMarkup(
      createElement(AttemptQuestionView, {
        copy,
        question: choice,
        picked: [],
        onPick: () => {},
      }),
    )
    expect(html).not.toContain(copy.gradeCorrectAnswer)
    expect(html).not.toContain(copy.gradeAutoWrong)
  })
})
