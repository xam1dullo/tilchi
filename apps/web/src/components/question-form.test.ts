import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { messages } from '../lib/i18n'
import {
  emptyDraft,
  type QuestionDraft,
  type QuestionRecord,
} from '../lib/question-form'
import { QuestionForm, QuestionView } from './question-form'

const copy = messages('en')

const form = (draft: QuestionDraft) =>
  renderToStaticMarkup(
    createElement(QuestionForm, {
      copy,
      draft,
      editing: false,
      busy: false,
      errors: [],
      onChange: () => {},
      onSubmit: () => {},
      onCancel: () => {},
    }),
  )

describe('QuestionForm', () => {
  it('uses radios for single, checkboxes for multi, nothing for speaking', () => {
    expect(form(emptyDraft('single'))).toContain('type="radio"')
    expect(form(emptyDraft('multi'))).toContain('type="checkbox"')
    const speaking = form(emptyDraft('speaking'))
    expect(speaking).not.toContain(copy.questionOptions)
    expect(speaking).not.toContain('type="radio"')
  })
})

describe('QuestionView', () => {
  it('marks the correct options in words, not only colour', () => {
    const question: QuestionRecord = {
      id: 'q',
      type: 'single',
      prompt: 'Hi',
      options: [
        { id: 'a', text: 'Yes' },
        { id: 'b', text: 'No' },
      ],
      answerKey: ['b'],
      status: 'published',
    }
    const html = renderToStaticMarkup(
      createElement(QuestionView, { copy, question }),
    )
    expect(html).toContain('data-correct="false">Yes</li>')
    expect(html).toContain(
      `No<span class="question-correct"> (${copy.questionCorrect})`,
    )
    expect(html).toContain(copy.coursePublished)
  })
})
