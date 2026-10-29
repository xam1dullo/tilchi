import { describe, expect, it } from 'vitest'
import {
  SPEAKING_MAX,
  type TestQuestion,
  gradeAttempt,
  isCorrect,
  maxScore,
} from './grading'

const opts = ['a', 'b', 'c'].map((id) => ({ id, text: id }))
const single: TestQuestion = {
  id: 's',
  type: 'single',
  prompt: 'p',
  options: opts,
  answerKey: ['b'],
}
const multi: TestQuestion = {
  id: 'm',
  type: 'multi',
  prompt: 'p',
  options: opts,
  answerKey: ['a', 'c'],
}
const speaking: TestQuestion = {
  id: 'v',
  type: 'speaking',
  prompt: 'p',
  options: null,
  answerKey: null,
}
const none = { speaking: {}, overrides: {}, feedback: null }

describe('isCorrect', () => {
  it('single needs exactly the key', () => {
    expect(isCorrect(single, ['b'])).toBe(true)
    expect(isCorrect(single, ['a'])).toBe(false)
    expect(isCorrect(single, ['a', 'b'])).toBe(false)
    expect(isCorrect(single, [])).toBe(false)
    expect(isCorrect(single, undefined)).toBe(false)
  })

  it('multi needs the whole set in any order, no partial credit', () => {
    expect(isCorrect(multi, ['c', 'a'])).toBe(true)
    expect(isCorrect(multi, ['a'])).toBe(false)
    expect(isCorrect(multi, ['a', 'b', 'c'])).toBe(false)
    expect(isCorrect(multi, ['a', 'a'])).toBe(false)
  })

  it('never auto-checks speaking', () => {
    expect(isCorrect(speaking, ['a'])).toBe(false)
  })
})

describe('gradeAttempt', () => {
  const qs = [single, multi, speaking]

  it('adds auto-checked choices and teacher-scored speaking', () => {
    const graded = gradeAttempt(qs, { s: ['b'], m: ['a'] }, new Set(['v']), {
      ...none,
      speaking: { v: 4 },
    })
    expect(graded).toEqual({
      ok: true,
      score: 1 + 0 + 4,
      max: 1 + 1 + SPEAKING_MAX,
      result: {
        s: { points: 1, max: 1 },
        m: { points: 0, max: 1 },
        v: { points: 4, max: SPEAKING_MAX },
      },
    })
  })

  it('lets the teacher overturn the auto-check either way', () => {
    const graded = gradeAttempt(qs, { s: ['b'], m: ['a'] }, new Set(), {
      ...none,
      overrides: { s: false, m: true },
    })
    expect(graded).toMatchObject({ ok: true, score: 1 })
    if (graded.ok) {
      expect(graded.result.s.points).toBe(0)
      expect(graded.result.m.points).toBe(1)
    }
  })

  it('asks for a score when a recording exists, and gives 0 when none', () => {
    expect(gradeAttempt([speaking], {}, new Set(['v']), none)).toEqual({
      ok: false,
      error: 'speaking_score_required',
    })
    expect(gradeAttempt([speaking], {}, new Set(), none)).toMatchObject({
      ok: true,
      score: 0,
    })
  })

  it('ignores a score given for a question with no recording', () => {
    expect(
      gradeAttempt([speaking], {}, new Set(), {
        ...none,
        speaking: { v: 5 },
      }),
    ).toMatchObject({ score: 0 })
  })

  it('counts max points per type', () => {
    expect(maxScore(qs)).toBe(2 + SPEAKING_MAX)
    expect(maxScore([])).toBe(0)
  })
})

describe('malformed questions', () => {
  it('never auto-check a speaking question that has a key, or a choice without one', () => {
    expect(isCorrect({ ...speaking, answerKey: ['a'] }, ['a'])).toBe(false)
    expect(isCorrect({ ...single, answerKey: null }, [])).toBe(false)
  })
})
