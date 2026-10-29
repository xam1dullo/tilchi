/**
 * Pure prompt building for the lesson helper. The prompt carries lesson
 * context and the question only: never a group name (1:1 groups are named
 * after the learner), phone, e-mail, handle or Telegram id (PRD Compliance).
 */

export const MAX_QUESTION_CHARS = 600
export const MAX_OUTPUT_TOKENS = 600

const REMOVED = '[removed]'

// Order matters: links and e-mails first so their digits or handles are not
// half-eaten, then phones, then any remaining long digit run (Telegram ids).
const PII_PATTERNS: RegExp[] = [
  /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/\S+/gi,
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /(?<![\w])@\w{3,}/g,
  /\+?\d[\d\s().-]{6,}\d/g,
  /\d{5,}/g,
]

// A self-introduction followed by capitalised words: "My name is Ali Valiyev",
// "Mening ismim Ali", "Меня зовут Али". ponytail: a heuristic — it misses
// lowercase names and can catch "I am English". The consent text covers the
// foreign provider; upgrade to an NER pass if names still slip through.
const SELF_INTRO =
  /(?<![\p{L}])((?:[Mm]y name is|I am|I['’]m|[Mm]ening ismim|[Ii]smim|[Мм]еня зовут)\s+)\p{Lu}[\p{L}'’-]*(?:\s+\p{Lu}[\p{L}'’-]*)*/gu

export function stripPii(text: string): string {
  return PII_PATTERNS.reduce(
    (out, re) => out.replace(re, REMOVED),
    text.replace(SELF_INTRO, '$1[name]'),
  )
}

export type LessonContext = {
  level: string | null
  scheduledAt: string | null
}

const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

/** Builds the context from the API lesson payload, keeping only safe fields. */
export function lessonContext(body: unknown): LessonContext | null {
  const { lesson, group } = (body ?? {}) as {
    lesson?: { scheduledAt?: unknown }
    group?: { level?: unknown }
  }
  if (!group || typeof group !== 'object') return null
  const level =
    typeof group.level === 'string' && LEVELS.has(group.level.toUpperCase())
      ? group.level.toUpperCase()
      : null
  const when = lesson?.scheduledAt
  const scheduledAt =
    typeof when === 'string' && !Number.isNaN(Date.parse(when)) ? when : null
  return { level, scheduledAt }
}

export const SYSTEM_PROMPT = [
  'You are a helper for an English lesson at Tilchi, an online English school.',
  'Answer questions about English: grammar, vocabulary, pronunciation, meaning and usage, and how to study for the lesson.',
  'Answer in the language the learner writes in. Keep answers short and clear, with one or two examples.',
  'You do NOT write tests, quizzes, exams, exercises or question sets, and you do not grade speaking. If asked, say briefly that the teacher prepares those and offer to explain the topic instead.',
  'You do not know who the learners or the teacher are and must not ask for names, phone numbers or other personal data.',
  'Stay on English learning. Politely decline anything else.',
].join('\n')

export function cleanQuestion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const question = stripPii(raw).trim()
  if (question.length === 0 || question.length > MAX_QUESTION_CHARS) return null
  return question
}

export function buildPrompt(context: LessonContext, question: string) {
  const lines: string[] = []
  if (context.level) lines.push(`Level: ${context.level}`)
  if (context.scheduledAt) lines.push(`Scheduled: ${context.scheduledAt}`)
  return {
    system: SYSTEM_PROMPT,
    user: [...lines, '', `Question: ${question}`].join('\n').trimStart(),
  }
}
