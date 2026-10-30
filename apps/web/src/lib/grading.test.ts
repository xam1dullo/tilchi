import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import type { AttemptQuestion } from './attempt'
import {
  emptyGrade,
  gradeBody,
  gradeError,
  gradeErrors,
  gradeTotal,
  isManagerView,
} from './grading'

const options = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
]
const single: AttemptQuestion = {
  id: 's',
  type: 'single',
  prompt: 'S',
  options,
  answerKey: ['a'],
  autoCorrect: true,
}
const multi: AttemptQuestion = {
  id: 'm',
  type: 'multi',
  prompt: 'M',
  options,
  answerKey: ['a', 'b'],
  autoCorrect: false,
}
const spoken: AttemptQuestion = {
  id: 'v',
  type: 'speaking',
  prompt: 'V',
  options: null,
  answerKey: null,
  autoCorrect: null,
}
const silent: AttemptQuestion = { ...spoken, id: 'w' }
const questions = [single, multi, spoken, silent]
const recorded = ['v']
const draft = (patch: Partial<ReturnType<typeof emptyGrade>>) => ({
  ...emptyGrade(),
  ...patch,
})

describe('isManagerView', () => {
  it('is true only when the server sent the key', () => {
    expect(isManagerView({ questions })).toBe(true)
    expect(
      isManagerView({
        questions: [{ id: 's', type: 'single', prompt: 'S', options }],
      }),
    ).toBe(false)
  })
})

describe('gradeBody', () => {
  it('matches parseGrade: recorded speaking scores, choice overrides, trimmed feedback', () => {
    expect(
      gradeBody(
        questions,
        recorded,
        draft({
          speaking: { v: ' 4 ', w: '5' },
          overrides: { m: true },
          feedback: '  Good fluency ',
        }),
      ),
    ).toEqual({
      speaking: { v: 4 },
      overrides: { m: true },
      feedback: 'Good fluency',
    })
  })

  it('sends empty feedback as null and no blank scores', () => {
    expect(
      gradeBody(questions, recorded, draft({ speaking: { v: ' ' } })),
    ).toEqual({ speaking: {}, overrides: {}, feedback: null })
  })
})

describe('gradeErrors', () => {
  it('needs a whole 0..5 score for every recorded speaking answer', () => {
    expect(gradeErrors(questions, recorded, draft({}))).toEqual([
      'gradeSpeakingInvalid',
    ])
    for (const bad of ['6', '-1', '2.5', 'x']) {
      expect(
        gradeErrors(questions, recorded, draft({ speaking: { v: bad } })),
      ).toEqual(['gradeSpeakingInvalid'])
    }
    expect(
      gradeErrors(questions, recorded, draft({ speaking: { v: '0' } })),
    ).toEqual([])
    expect(gradeErrors(questions, [], draft({}))).toEqual([])
  })

  it('caps feedback at 2000 characters after trimming', () => {
    const ok = draft({
      speaking: { v: '5' },
      feedback: ` ${'x'.repeat(2000)} `,
    })
    expect(gradeErrors(questions, recorded, ok)).toEqual([])
    const long = draft({ speaking: { v: '5' }, feedback: 'x'.repeat(2001) })
    expect(gradeErrors(questions, recorded, long)).toEqual([
      'gradeFeedbackInvalid',
    ])
  })
})

describe('gradeTotal', () => {
  it('adds auto checks, overrides and recorded speaking scores', () => {
    expect(gradeTotal(questions, recorded, draft({}))).toBe(1)
    expect(
      gradeTotal(
        questions,
        recorded,
        draft({
          overrides: { m: true },
          speaking: { v: '4', w: '5' },
        }),
      ),
    ).toBe(6)
    expect(
      gradeTotal(questions, recorded, draft({ overrides: { s: false } })),
    ).toBe(0)
  })
})

describe('gradeError', () => {
  it('maps server codes and 403, unknown ones generic', () => {
    const err = (status: number, error: string) =>
      gradeError(new ApiError(status, { error }))
    expect(err(400, 'speaking_score_required')).toBe('gradeSpeakingInvalid')
    expect(err(400, 'invalid_feedback')).toBe('gradeFeedbackInvalid')
    expect(err(400, 'invalid_grade')).toBe('gradeInvalid')
    expect(err(409, 'already_graded')).toBe('gradeAlreadyGraded')
    expect(err(409, 'not_submitted')).toBe('gradeNotSubmitted')
    expect(err(404, 'not_found')).toBe('attemptNotFound')
    expect(err(403, 'forbidden')).toBe('gradeForbidden')
    expect(gradeError(new Error('constructor'))).toBe('courseUnavailable')
  })
})
