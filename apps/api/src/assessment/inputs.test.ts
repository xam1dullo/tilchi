import { describe, expect, it } from 'vitest'
import type { TestQuestion } from './grading'
import {
  parseAnswers,
  parseAssign,
  parseGrade,
  parseNewQuestion,
  parsePresign,
  parseQuestionPatch,
  parseTest,
} from './inputs'

const code = (run: () => unknown) => {
  try {
    run()
    return 'ok'
  } catch (error) {
    return (error as { response: { error: string } }).response.error
  }
}

const opts = ['a', 'b', 'c'].map((id) => ({ id, text: id }))
const single: TestQuestion = {
  id: 's',
  type: 'single',
  prompt: 'p',
  options: opts,
  answerKey: ['a'],
}
const multi: TestQuestion = {
  id: 'm',
  type: 'multi',
  prompt: 'p',
  options: opts,
  answerKey: ['a', 'b'],
}
const speaking: TestQuestion = {
  id: 'v',
  type: 'speaking',
  prompt: 'p',
  options: null,
  answerKey: null,
}
const all = [single, multi, speaking]
const uuid = '0192a7e0-0000-7000-8000-000000000001'

describe('parseNewQuestion', () => {
  it('names options a.. and stores the key as option ids, sorted', () => {
    expect(
      parseNewQuestion({
        type: 'multi',
        prompt: ' Q ',
        options: ['x', 'y', 'z'],
        correct: [2, 0],
      }),
    ).toEqual({
      type: 'multi',
      prompt: 'Q',
      options: [
        { id: 'a', text: 'x' },
        { id: 'b', text: 'y' },
        { id: 'c', text: 'z' },
      ],
      answerKey: ['a', 'c'],
    })
  })

  it('accepts a bare speaking question', () => {
    expect(parseNewQuestion({ type: 'speaking', prompt: 'Q' })).toEqual({
      type: 'speaking',
      prompt: 'Q',
      options: null,
      answerKey: null,
    })
  })

  it('refuses every malformed shape with a stable code', () => {
    const base = {
      type: 'single',
      prompt: 'Q',
      options: ['a', 'b'],
      correct: [0],
    }
    expect(code(() => parseNewQuestion(null))).toBe('invalid_question')
    expect(code(() => parseNewQuestion([]))).toBe('invalid_question')
    expect(code(() => parseNewQuestion({ ...base, extra: 1 }))).toBe(
      'invalid_question',
    )
    expect(code(() => parseNewQuestion({ ...base, prompt: '' }))).toBe(
      'invalid_prompt',
    )
    expect(
      code(() => parseNewQuestion({ ...base, prompt: 'x'.repeat(2001) })),
    ).toBe('invalid_prompt')
    expect(code(() => parseNewQuestion({ ...base, type: 'essay' }))).toBe(
      'invalid_type',
    )
    expect(code(() => parseNewQuestion({ ...base, options: ['a'] }))).toBe(
      'invalid_options',
    )
    expect(
      code(() => parseNewQuestion({ ...base, options: Array(9).fill('x') })),
    ).toBe('invalid_options')
    expect(code(() => parseNewQuestion({ ...base, options: ['a', ''] }))).toBe(
      'invalid_options',
    )
    expect(code(() => parseNewQuestion({ ...base, correct: [] }))).toBe(
      'invalid_answer_key',
    )
    expect(code(() => parseNewQuestion({ ...base, correct: [0, 1] }))).toBe(
      'invalid_answer_key',
    )
    expect(code(() => parseNewQuestion({ ...base, correct: [2] }))).toBe(
      'invalid_answer_key',
    )
    expect(code(() => parseNewQuestion({ ...base, correct: [-1] }))).toBe(
      'invalid_answer_key',
    )
    expect(code(() => parseNewQuestion({ ...base, correct: [0.5] }))).toBe(
      'invalid_answer_key',
    )
    expect(
      code(() =>
        parseNewQuestion({
          type: 'multi',
          prompt: 'Q',
          options: ['a', 'b'],
          correct: [0, 0],
        }),
      ),
    ).toBe('invalid_answer_key')
    expect(
      code(() =>
        parseNewQuestion({ type: 'speaking', prompt: 'Q', correct: [0] }),
      ),
    ).toBe('invalid_question')
  })
})

describe('parseQuestionPatch', () => {
  it('needs options and key together, and only for choice questions', () => {
    expect(
      code(() => parseQuestionPatch({ options: ['a', 'b'] }, single)),
    ).toBe('invalid_question')
    expect(code(() => parseQuestionPatch({ correct: [0] }, single))).toBe(
      'invalid_question',
    )
    expect(
      code(() =>
        parseQuestionPatch({ options: ['a', 'b'], correct: [0] }, speaking),
      ),
    ).toBe('invalid_question')
    expect(code(() => parseQuestionPatch({}, single))).toBe('invalid_question')
    expect(code(() => parseQuestionPatch({ status: 'draft' }, single))).toBe(
      'invalid_status',
    )
    expect(code(() => parseQuestionPatch({ type: 'multi' }, single))).toBe(
      'invalid_question',
    )
  })

  it('reads a publish and a prompt change', () => {
    expect(
      parseQuestionPatch({ status: 'published', prompt: 'N' }, single),
    ).toEqual({
      publish: true,
      prompt: 'N',
    })
  })
})

describe('parseTest', () => {
  it('needs a title and 1..50 distinct uuids', () => {
    expect(parseTest({ title: ' T ', questionIds: [uuid] })).toEqual({
      title: 'T',
      questionIds: [uuid],
    })
    expect(code(() => parseTest({ title: '', questionIds: [uuid] }))).toBe(
      'invalid_title',
    )
    expect(code(() => parseTest({ title: 'T', questionIds: [] }))).toBe(
      'invalid_questions',
    )
    expect(
      code(() => parseTest({ title: 'T', questionIds: [uuid, uuid] })),
    ).toBe('invalid_questions')
    expect(code(() => parseTest({ title: 'T', questionIds: ['nope'] }))).toBe(
      'invalid_questions',
    )
    expect(code(() => parseTest({ title: 'T', questionIds: 'x' }))).toBe(
      'invalid_questions',
    )
  })
})

describe('parseAssign', () => {
  const now = new Date('2030-01-01T00:00:00Z')
  it('needs a future ISO deadline', () => {
    expect(
      parseAssign({ testId: uuid, deadline: '2030-01-02T00:00:00Z' }, now)
        .deadline,
    ).toEqual(new Date('2030-01-02T00:00:00Z'))
    expect(
      code(() =>
        parseAssign({ testId: uuid, deadline: '2030-01-01T00:00:00Z' }, now),
      ),
    ).toBe('invalid_deadline')
    expect(
      code(() => parseAssign({ testId: uuid, deadline: 'tomorrow' }, now)),
    ).toBe('invalid_deadline')
    expect(code(() => parseAssign({ testId: uuid }, now))).toBe(
      'invalid_deadline',
    )
    expect(
      code(() =>
        parseAssign({ testId: 'x', deadline: '2031-01-01T00:00:00Z' }, now),
      ),
    ).toBe('invalid_test_id')
  })
})

describe('parseAnswers', () => {
  it('keeps valid choices sorted and refuses everything else', () => {
    expect(parseAnswers({ answers: { m: ['b', 'a'], s: ['c'] } }, all)).toEqual(
      { m: ['a', 'b'], s: ['c'] },
    )
    expect(parseAnswers({ answers: {} }, all)).toEqual({})
    for (const answers of [
      { s: ['a', 'b'] },
      { s: ['z'] },
      { s: 'a' },
      { s: [1] },
      { m: ['a', 'a'] },
      { v: ['a'] },
      { nope: ['a'] },
    ]) {
      expect(
        code(() => parseAnswers({ answers }, all)),
        JSON.stringify(answers),
      ).toBe('invalid_answers')
    }
    expect(code(() => parseAnswers({}, all))).toBe('invalid_answers')
    expect(code(() => parseAnswers({ answers: {}, x: 1 }, all))).toBe(
      'invalid_answers',
    )
  })
})

describe('parsePresign', () => {
  const ok = { questionId: uuid, contentType: 'audio/webm', size: 1000 }
  it('allows webm and mp4 up to 10 MB', () => {
    expect(parsePresign(ok)).toEqual(ok)
    expect(
      parsePresign({ ...ok, contentType: 'audio/mp4', size: 10 * 1024 * 1024 })
        .size,
    ).toBe(10 * 1024 * 1024)
  })
  it('refuses other types, empty or oversized files', () => {
    expect(code(() => parsePresign({ ...ok, contentType: 'audio/ogg' }))).toBe(
      'unsupported_audio_type',
    )
    expect(code(() => parsePresign({ ...ok, contentType: 'toString' }))).toBe(
      'unsupported_audio_type',
    )
    expect(code(() => parsePresign({ ...ok, size: 0 }))).toBe('audio_too_large')
    expect(
      code(() => parsePresign({ ...ok, size: 10 * 1024 * 1024 + 1 })),
    ).toBe('audio_too_large')
    expect(code(() => parsePresign({ ...ok, size: 1.5 }))).toBe(
      'audio_too_large',
    )
    expect(code(() => parsePresign({ ...ok, questionId: 'x' }))).toBe(
      'invalid_audio',
    )
  })
})

describe('parseGrade', () => {
  it('reads scores, overrides and feedback', () => {
    expect(
      parseGrade(
        { speaking: { v: 3 }, overrides: { s: true }, feedback: ' ok ' },
        all,
      ),
    ).toEqual({
      speaking: { v: 3 },
      overrides: { s: true },
      feedback: 'ok',
    })
    expect(parseGrade({}, all)).toEqual({
      speaking: {},
      overrides: {},
      feedback: null,
    })
  })
  it('refuses scores out of range, wrong question kinds and unknown ids', () => {
    for (const body of [
      { speaking: { v: 6 } },
      { speaking: { v: -1 } },
      { speaking: { v: 2.5 } },
      { speaking: { s: 1 } },
      { speaking: { nope: 1 } },
      { overrides: { v: true } },
      { overrides: { s: 'yes' } },
      { overrides: { nope: true } },
      { extra: 1 },
    ]) {
      expect(
        code(() => parseGrade(body, all)),
        JSON.stringify(body),
      ).toBe('invalid_grade')
    }
    expect(code(() => parseGrade({ feedback: '' }, all))).toBe(
      'invalid_feedback',
    )
  })
})

describe('boundaries', () => {
  const base = {
    type: 'single',
    prompt: 'Q',
    options: ['a', 'b'],
    correct: [0],
  }

  it('accepts the largest allowed prompt, option count, title, test and size', () => {
    expect(
      parseNewQuestion({ ...base, prompt: 'x'.repeat(2000) }).prompt,
    ).toHaveLength(2000)
    const eight = Array.from({ length: 8 }, (_, i) => `o${i}`)
    expect(
      parseNewQuestion({ ...base, options: eight, correct: [7] }).answerKey,
    ).toEqual(['h'])
    const ids = Array.from(
      { length: 50 },
      (_, i) => `0192a7e0-0000-7000-8000-${String(i).padStart(12, '0')}`,
    )
    expect(
      parseTest({ title: 'T', questionIds: ids }).questionIds,
    ).toHaveLength(50)
    expect(
      code(() => parseTest({ title: 'T', questionIds: [...ids, uuid] })),
    ).toBe('invalid_questions')
    expect(
      parsePresign({ questionId: uuid, contentType: 'audio/webm', size: 1 })
        .size,
    ).toBe(1)
    expect(parseGrade({ speaking: { v: 0 } }, all).speaking).toEqual({ v: 0 })
    expect(parseGrade({ speaking: { v: 5 } }, all).speaking).toEqual({ v: 5 })
  })

  it('takes a single question with one right option and a multi with several', () => {
    expect(parseNewQuestion(base).answerKey).toEqual(['a'])
    expect(code(() => parseNewQuestion({ ...base, correct: 'a' }))).toBe(
      'invalid_answer_key',
    )
    expect(code(() => parseNewQuestion({ ...base, correct: 0 }))).toBe(
      'invalid_answer_key',
    )
    expect(
      code(() => parseNewQuestion({ ...base, type: 'multi', correct: [] })),
    ).toBe('invalid_answer_key')
  })

  it('leaves a prompt-only patch unpublished', () => {
    expect(parseQuestionPatch({ prompt: 'N' }, single)).toEqual({
      prompt: 'N',
      publish: false,
    })
  })

  it('reads a choice answer for a question whose options are missing as invalid, not a crash', () => {
    const broken: TestQuestion = { ...single, options: null }
    expect(code(() => parseAnswers({ answers: { s: ['a'] } }, [broken]))).toBe(
      'invalid_answers',
    )
  })
})
