import { describe, expect, it } from 'vitest'
import {
  MAX_QUESTION_CHARS,
  SYSTEM_PROMPT,
  buildPrompt,
  mentionsOwnName,
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
    const question = cleanQuestion('What is "ubiquitous"? Call 540152508')
    expect(context).not.toBeNull()
    expect(question).not.toBeNull()
    const { system, user } = buildPrompt(context!, question!)
    expect(user).toBe(
      'Level: A2\nScheduled: 2026-11-02T10:00:00.000Z\n\nQuestion: What is "ubiquitous"? Call [removed]',
    )
    expect(`${system}${user}`).not.toMatch(/540152508|Ali|Valiyev/)
  })

  it('tells the model to refuse tests and questions (story 52)', () => {
    expect(SYSTEM_PROMPT).toMatch(/do NOT write tests, quizzes, exams/)
  })
})

describe('cleanQuestion', () => {
  it('flags self-introductions in any case, outside quotes', () => {
    for (const q of [
      'My name is Ali Valiyev, explain gerunds',
      'my name is ali ibn valiyev',
      'MY NAME IS ALI',
      "my name's sardor",
      'Mening ismim: Ali. Present perfect nima?',
      'my name is: sardor',
      'my  name   is Ali',
      'my name is. Ali',
      'my nameʼs Ali',
      'Explain gerunds. My name is "Ali".',
      'Explain gerunds. My name is ‘Ali’.',
      'Explain “my name is”. My name is Ali.',
      "Explain 'my name is'. My name is Ali.",
      'O‘zbekcha: my name is Ali',
      '‘gonna’ni tushuntiring. Mening ismim Ali, uyim tog’ yonida.',
      "'gonna'ni tushuntiring. Mening ismim Ali, uyim tog' yonida.",
      "Rock 'n roll. My name is Ali, my parents' house",
      'What is "present perfect? My name is Ali. Also "used to" please',
      'I am 5\'9" tall. My name is Ali. What does "gonna" mean?',
      'Explain “gonna". My name is Ali. And "wanna”',
      'my name is + Ali',
      'My name is = Ali',
      `my name is${' '.repeat(40)}Ali`,
      'my name is 1. Ali',
      // Fails closed on purpose: a plural possessive inside a quote reads as
      // the closing quote. Taking the longest quote instead would let
      // "'a' my name is Ali, it's 'b'" through.
      "Explain 'the students' books; my name is Ali' in Uzbek.",
      // Fails closed on purpose: only a quote that opens right before the
      // phrase hides it.
      'Translate ‘my name’s Ali and my name is Bob’ into Uzbek.',
      `Translate "${'Please '.repeat(18)}my name is Ali" into Uzbek.`,
      "'gonna'ni tushuntiring, mening ismim Ali, uyim tog' yonida",
      '‘gonna’ni tushuntiring, mening ismim Ali, uyim tog’ yonida',
      "I was born in the '90s and my name is Ali, at my parents' house",
      "Tell 'em my name is Ali, it's my friends' idea",
      'My TV is 55" wide, "gonna" means going to, my name is Ali, and "wanna"?',
      'Explain "gonna, "wanna" - my name is Ali - and "gotta"',
      '"my name is Ali',
      "'\nmy name is Ali'",
      '“\nmy name is Ali”',
      'my name‘s Ali',
      'my nameʻs Ali',
      'my name`s Ali',
      'my name´s Ali',
      '"my name is Ali\rhow do I say "hi"',
      '"my name is Ali.How do I say "hi"',
      "'my name is Ali, men tog' tomon boraman",
      "'my name is Ali, I like rock 'n' roll",
      '"my name is Ali; how do I say "hi"?',
      "'my name is Ali.🙂 Hello'",
      '"My name is Ali.(I am 20) What does "run" mean?',
      '"My name is Ali.— what does "run" mean?',
      'mynameis Ali',
      "'my name is'larni tarjima qil",
      "'My name is Ali men ko'chada yashayman. What does run mean?",
      'my\u2800name\u2800is Ali',
      'my\u3164name is Ali',
      'is\u200bmim Ali',
      'mening\u200bis\u200bmim Ali',
      'меня\u200bзо\u200bвут Али',
      'Hello\u200bmy na\u200bme is Ali',
      'my\u2060name\u00adis Ali',
      "'my name is Ali. Hi'",
      'My name is → Ali',
      'my name is 😊 Ali',
      'my name is\u200bAli',
      'my na\u00adme is Ali',
      'Менинг исмим Али',
      'Mening ismim Ali. Present perfect nima?',
      'ismim sardor',
      'Меня зовут Али',
      'моё имя али',
    ]) {
      expect(mentionsOwnName(q), q).toBe(true)
    }
  })

  it('keeps ordinary sentences, levels and quoted examples', () => {
    for (const q of [
      'I am confused about articles',
      'I am B2, explain inversion',
      'Men ingliz tilini o‘rganyapman',
      'Я не понимаю present perfect',
      'What does "call me a taxi" mean?',
      'What does call me a taxi mean?',
      'Ismimni inglizcha qanday yozaman?',
      "What does 'my name is Ali' mean?",
      "Translate 'my name's Ali' into Uzbek.",
      'What does ‘my name is Ali’ mean?',
      'I am confused. Explain articles.',
      'I am learning. Explain gerunds.',
      'Explain “my name is” in a sentence',
      "'my name is Ali'ni tarjima qiling",
      '‘my name is Ali’ni tarjima qiling',
      "'my name is Ali'mi?",
      "'my name is Ali'NI tarjima",
      "'ismim'dek so'z",
      "'ismim'lik so'z",
      '"my name is Ali!" ok?',
      '“my name is” means what?',
      '"my name is..." how do I end it?',
      'Is "My name is Ali 3.5 m" ok?',
      '„my name is Ali“ tarjimasi',
      '«меня зовут Али» — что это?',
    ]) {
      expect(mentionsOwnName(q), q).toBe(false)
    }
  })

  it('stays fast on stacked Uzbek suffixes', () => {
    const started = performance.now()
    mentionsOwnName(`'my name is Ali'${'gacha'.repeat(110)}x`)
    expect(performance.now() - started).toBeLessThan(100)
  })

  it('rejects over-long raw input before scanning it', () => {
    const huge = 'a'.repeat(200_000)
    const started = performance.now()
    expect(cleanQuestion(huge)).toBeNull()
    expect(performance.now() - started).toBeLessThan(50)
  })

  it('rejects non-strings, blanks and over-long input', () => {
    expect(cleanQuestion(undefined)).toBeNull()
    expect(cleanQuestion('   ')).toBeNull()
    expect(cleanQuestion('a'.repeat(MAX_QUESTION_CHARS + 1))).toBeNull()
    expect(cleanQuestion('a'.repeat(MAX_QUESTION_CHARS))).not.toBeNull()
  })
})
