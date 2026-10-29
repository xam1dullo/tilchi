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

  it('keeps level and time only, never the group name', () => {
    expect(lessonContext(body)).toEqual({
      level: 'B2',
      scheduledAt: '2026-11-02T10:00:00.000Z',
    })
  })

  it('drops an unknown level and a bad date', () => {
    expect(
      lessonContext({
        lesson: { scheduledAt: 'soon' },
        group: { name: 'Ali Valiyev — 1:1', level: 'expert' },
      }),
    ).toEqual({ level: null, scheduledAt: null })
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
      group: { name: 'Ali Valiyev 1:1', level: 'A2' },
    })
    const question = cleanQuestion('What is "ubiquitous"? I am Ali, 540152508')
    expect(context).not.toBeNull()
    expect(question).not.toBeNull()
    const { system, user } = buildPrompt(context!, question!)
    expect(user).toBe(
      'Level: A2\nScheduled: 2026-11-02T10:00:00.000Z\n\nQuestion: What is "ubiquitous"? I am [name], [removed]',
    )
    expect(`${system}${user}`).not.toMatch(/540152508|Ali|Valiyev/)
  })

  it('tells the model to refuse tests and questions (story 52)', () => {
    expect(SYSTEM_PROMPT).toMatch(/do NOT write tests, quizzes, exams/)
  })
})

describe('cleanQuestion', () => {
  it('replaces self-introduced names in uz, ru and en', () => {
    expect(cleanQuestion('My name is Ali Valiyev, explain gerunds')).toBe(
      'My name is [name], explain gerunds',
    )
    expect(cleanQuestion('Mening ismim Ali. Present perfect nima?')).toBe(
      'Mening ismim [name]. Present perfect nima?',
    )
    expect(cleanQuestion('Меня зовут Али Валиев, что такое gerund?')).toBe(
      'Меня зовут [name], что такое gerund?',
    )
    expect(cleanQuestion("I'm Ali and I need help with articles")).toBe(
      "I'm [name] and I need help with articles",
    )
  })

  it('keeps ordinary "I am" sentences and CEFR levels', () => {
    expect(cleanQuestion('I am confused about articles')).toBe(
      'I am confused about articles',
    )
    expect(cleanQuestion('I am B2, explain inversion')).toBe(
      'I am B2, explain inversion',
    )
    expect(cleanQuestion('My name is ALI, help me')).toBe(
      'My name is [name], help me',
    )
  })

  it('rejects non-strings, blanks and over-long input', () => {
    expect(cleanQuestion(undefined)).toBeNull()
    expect(cleanQuestion('   ')).toBeNull()
    expect(cleanQuestion('a'.repeat(MAX_QUESTION_CHARS + 1))).toBeNull()
    expect(cleanQuestion('a'.repeat(MAX_QUESTION_CHARS))).not.toBeNull()
  })
})
