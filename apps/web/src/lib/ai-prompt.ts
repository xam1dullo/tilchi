/**
 * Pure prompt building for the lesson helper. The prompt carries lesson text
 * only: never a name, phone, e-mail, handle or Telegram id (PRD Compliance).
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

export function stripPii(text: string): string {
  return PII_PATTERNS.reduce((out, re) => out.replace(re, REMOVED), text)
}

export type LessonContext = {
  title: string
  level: string | null
  scheduledAt: string | null
}

const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

/** Builds the context from the API lesson payload, keeping only safe fields. */
export function lessonContext(body: unknown): LessonContext | null {
  const { lesson, group } = (body ?? {}) as {
    lesson?: { scheduledAt?: unknown }
    group?: { name?: unknown; level?: unknown }
  }
  if (typeof group?.name !== 'string') return null
  const level =
    typeof group.level === 'string' && LEVELS.has(group.level.toUpperCase())
      ? group.level.toUpperCase()
      : null
  const when = lesson?.scheduledAt
  const scheduledAt =
    typeof when === 'string' && !Number.isNaN(Date.parse(when)) ? when : null
  return { title: stripPii(group.name).slice(0, 120), level, scheduledAt }
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
  const lines = [`Lesson: ${context.title}`]
  if (context.level) lines.push(`Level: ${context.level}`)
  if (context.scheduledAt) lines.push(`Scheduled: ${context.scheduledAt}`)
  return {
    system: SYSTEM_PROMPT,
    user: `${lines.join('\n')}\n\nQuestion: ${question}`,
  }
}
