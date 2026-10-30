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

const form = (draft: QuestionDraft, locked = false) =>
  renderToStaticMarkup(
    createElement(QuestionForm, {
      copy,
      draft,
      editing: false,
      locked,
      saving: false,
      errors: [],
      attempt: 0,
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

  it('freezes every control while a request is in flight', () => {
    expect(form(emptyDraft(), true)).toContain(
      '<fieldset class="question-lock" disabled="">',
    )
    expect(form(emptyDraft())).not.toContain('question-lock" disabled')
  })

  it('names each correct-answer control by its option number', () => {
    expect(form(emptyDraft('single'))).toContain(
      `aria-label="${copy.questionCorrect}: ${copy.questionOption} 2"`,
    )
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
