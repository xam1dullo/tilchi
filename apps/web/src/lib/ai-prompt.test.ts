import { describe, expect, it } from 'vitest'
import {
  MAX_QUESTION_CHARS,
  SYSTEM_PROMPT,
  buildPrompt,
  cleanQuestion,
  lessonContext,
  stripPii,
} from './ai-prompt'

describe('stripPii', () => {
  it.each([
    ['mail me at ali.valiyev@gmail.com now', 'ali.valiyev@gmail.com'],
    ['call +998 90 123 45 67 please', '998 90 123'],
    ['call 90-123-45-67', '123-45-67'],
    ['my id is 540152508', '540152508'],
    ['ping @mukhtasar_k', '@mukhtasar_k'],
    ['see https://t.me/someone_private', 't.me/someone_private'],
  ])('removes %s', (input, leaked) => {
    const out = stripPii(input)
    expect(out).not.toContain(leaked)
    expect(out).toContain('[removed]')
  })

  it('keeps ordinary English, short numbers and years', () => {
    const text =
      'Use present perfect in 2026 with 3 examples, e.g. "I have 2 cats".'
    expect(stripPii(text)).toBe(text)
  })
})

describe('lessonContext', () => {
  const body = {
    lesson: {
      id: 'l1',
      scheduledAt: '2026-11-02T10:00:00.000Z',
      status: 'live',
    },
    group: { id: 'g1', name: 'IELTS 7 evening', level: 'b2' },
    user: { name: 'Ali Valiyev', telegramId: '540152508' },
  }

  it('keeps title, level and time only', () => {
    expect(lessonContext(body)).toEqual({
      title: 'IELTS 7 evening',
      level: 'B2',
      scheduledAt: '2026-11-02T10:00:00.000Z',
    })
  })

  it('drops an unknown level and a bad date, and scrubs the title', () => {
    expect(
      lessonContext({
        lesson: { scheduledAt: 'soon' },
        group: { name: 'Group +998901234567', level: 'expert' },
      }),
    ).toEqual({ title: 'Group [removed]', level: null, scheduledAt: null })
  })

  it('rejects a payload without a group name', () => {
    expect(lessonContext({ lesson: {} })).toBeNull()
    expect(lessonContext(null)).toBeNull()
  })
})

describe('buildPrompt', () => {
  it('has no names, ids or phones, only lesson text and the question', () => {
    const context = lessonContext({
      lesson: { scheduledAt: '2026-11-02T10:00:00.000Z' },
      group: { name: 'Kids A2', level: 'A2' },
    })
    const question = cleanQuestion('What is "ubiquitous"? I am Ali, 540152508')
    expect(context).not.toBeNull()
    expect(question).not.toBeNull()
    const { system, user } = buildPrompt(context!, question!)
    expect(user).toBe(
      'Lesson: Kids A2\nLevel: A2\nScheduled: 2026-11-02T10:00:00.000Z\n\nQuestion: What is "ubiquitous"? I am Ali, [removed]',
    )
    expect(`${system}${user}`).not.toMatch(/540152508/)
  })

  it('tells the model to refuse tests and questions (story 52)', () => {
    expect(SYSTEM_PROMPT).toMatch(/do NOT write tests, quizzes, exams/)
  })
})

describe('cleanQuestion', () => {
  it('rejects non-strings, blanks and over-long input', () => {
    expect(cleanQuestion(undefined)).toBeNull()
    expect(cleanQuestion('   ')).toBeNull()
    expect(cleanQuestion('a'.repeat(MAX_QUESTION_CHARS + 1))).toBeNull()
    expect(cleanQuestion('a'.repeat(MAX_QUESTION_CHARS))).not.toBeNull()
  })
})
