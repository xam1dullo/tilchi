import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { copy } from './i18n'
import {
  addOption,
  bankError,
  draftErrors,
  draftFromQuestion,
  emptyDraft,
  filterQuestions,
  type QuestionDraft,
  type QuestionRecord,
  removeOption,
  setOption,
  testErrors,
  toQuestionBody,
  toQuestionPatch,
  toTestBody,
  toggleCorrect,
  togglePick,
  withType,
} from './question-form'

const choice = (over: Partial<QuestionDraft> = {}): QuestionDraft => ({
  type: 'multi',
  prompt: ' Pick ',
  options: [' a ', 'b', 'c'],
  correct: [0, 2],
  ...over,
})

const record: QuestionRecord = {
  id: 'q1',
  type: 'multi',
  prompt: 'Pick',
  options: [
    { id: 'a', text: 'a' },
    { id: 'b', text: 'b' },
    { id: 'c', text: 'c' },
  ],
  answerKey: ['a', 'c'],
  status: 'draft',
}

describe('question draft', () => {
  it('starts with two empty options, speaking with none', () => {
    expect(emptyDraft()).toEqual({
      type: 'single',
      prompt: '',
      options: ['', ''],
      correct: [],
    })
    expect(emptyDraft('speaking').options).toEqual([])
  })

  it('drops options for speaking and keeps one correct for single', () => {
    expect(withType(choice(), 'speaking')).toMatchObject({
      options: [],
      correct: [],
    })
    expect(withType(choice(), 'single').correct).toEqual([0])
    expect(withType(emptyDraft('speaking'), 'multi').options).toEqual(['', ''])
  })

  it('keeps 2..8 options', () => {
    let draft = emptyDraft()
    for (let i = 0; i < 10; i++) draft = addOption(draft)
    expect(draft.options).toHaveLength(8)
    expect(removeOption(emptyDraft(), 0).options).toHaveLength(2)
  })

  it('re-indexes correct answers when an option is removed', () => {
    expect(removeOption(choice(), 1).correct).toEqual([0, 1])
    expect(removeOption(choice(), 0)).toMatchObject({
      options: ['b', 'c'],
      correct: [1],
    })
  })

  it('single replaces the correct answer, multi toggles', () => {
    expect(toggleCorrect(choice({ type: 'single' }), 1).correct).toEqual([1])
    expect(toggleCorrect(choice(), 1).correct).toEqual([0, 1, 2])
    expect(toggleCorrect(choice(), 0).correct).toEqual([2])
    expect(setOption(choice(), 1, 'x').options).toEqual([' a ', 'x', 'c'])
  })

  it('reports client errors mirroring the server limits', () => {
    expect(draftErrors(choice())).toEqual([])
    expect(draftErrors(emptyDraft())).toEqual([
      'questionPromptInvalid',
      'questionOptionsInvalid',
      'questionKeyInvalid',
    ])
    expect(draftErrors(choice({ prompt: 'x'.repeat(2001) }))).toEqual([
      'questionPromptInvalid',
    ])
    expect(draftErrors(choice({ options: ['a', 'x'.repeat(301)] }))).toEqual([
      'questionOptionsInvalid',
    ])
    expect(draftErrors(choice({ type: 'single' }))).toEqual([
      'questionKeyInvalid',
    ])
    expect(draftErrors({ ...emptyDraft('speaking'), prompt: 'Talk' })).toEqual(
      [],
    )
  })
})

describe('request bodies', () => {
  it('trims and sends options only for choice questions', () => {
    expect(toQuestionBody(choice({ correct: [2, 0] }))).toEqual({
      type: 'multi',
      prompt: 'Pick',
      options: ['a', 'b', 'c'],
      correct: [0, 2],
    })
    expect(
      toQuestionBody({ ...emptyDraft('speaking'), prompt: ' Talk ' }),
    ).toEqual({
      type: 'speaking',
      prompt: 'Talk',
    })
  })

  it('reads a stored question back into a draft', () => {
    expect(draftFromQuestion(record)).toEqual({
      type: 'multi',
      prompt: 'Pick',
      options: ['a', 'b', 'c'],
      correct: [0, 2],
    })
  })

  it('patches only what changed, options and correct together', () => {
    const draft = draftFromQuestion(record)
    expect(toQuestionPatch(draft, record)).toBeNull()
    expect(toQuestionPatch({ ...draft, prompt: 'New' }, record)).toEqual({
      prompt: 'New',
    })
    expect(toQuestionPatch(toggleCorrect(draft, 1), record)).toEqual({
      options: ['a', 'b', 'c'],
      correct: [0, 1, 2],
    })
    const speaking = { ...record, type: 'speaking' as const, options: null }
    expect(
      toQuestionPatch(
        { ...draftFromQuestion(speaking), prompt: 'x' },
        speaking,
      ),
    ).toEqual({ prompt: 'x' })
  })

  it('builds a test body in pick order', () => {
    const ids = togglePick(togglePick(togglePick([], 'b'), 'a'), 'c')
    expect(togglePick(ids, 'a')).toEqual(['b', 'c'])
    expect(toTestBody(' Quiz ', ids)).toEqual({
      title: 'Quiz',
      questionIds: ['b', 'a', 'c'],
    })
    expect(testErrors('Quiz', ids)).toEqual([])
    expect(testErrors(' ', [])).toEqual([
      'testTitleInvalid',
      'testQuestionsInvalid',
    ])
    expect(testErrors('x'.repeat(121), Array(51).fill('i'))).toHaveLength(2)
  })

  it('filters the bank by status', () => {
    const published = { ...record, id: 'q2', status: 'published' as const }
    expect(filterQuestions([record, published], 'published')).toEqual([
      published,
    ])
    expect(filterQuestions([record, published], 'all')).toHaveLength(2)
  })
})

describe('bankError', () => {
  it('maps server codes to copy keys that exist in every locale', () => {
    const codes = [
      'invalid_prompt',
      'invalid_options',
      'invalid_answer_key',
      'not_draft',
      'in_use',
      'not_found',
      'invalid_title',
      'invalid_questions',
    ]
    for (const code of codes) {
      const key = bankError(new ApiError(400, { error: code }))
      expect(key).not.toBe('courseUnavailable')
      for (const locale of Object.values(copy)) expect(locale[key]).toBeTruthy()
    }
    expect(bankError(new ApiError(409, { error: 'not_draft' }))).toBe(
      'questionNotDraft',
    )
    expect(bankError(new ApiError(400, { error: 'toString' }))).toBe(
      'courseUnavailable',
    )
    expect(bankError(new TypeError('network'))).toBe('courseUnavailable')
  })
})
