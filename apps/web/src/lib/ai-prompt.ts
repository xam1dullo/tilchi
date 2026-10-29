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

// A learner introducing themselves by name. Rewriting names out of free text
// proved leaky, and guessing at "I am …" blocked ordinary questions ("I am
// confused."), so only unambiguous name phrases are refused (any case, any
// punctuation after them); quoted examples are ignored. PM decision
// (PRD Compliance): this is a guard, not a guarantee — a name typed without
// such a phrase still reaches the model; consent and the UI warning cover it.
// Quoted examples are ignored, but only when the quote opens right before the
// phrase and closes later in the same sentence: 'my name is Ali', “my name
// is”, «меня зовут Али». Pairing quotes across the whole text proved leaky
// (stray ", word-final ' in tog', '90s), so no other quote ever hides a
// phrase; a phrase in the middle of a quote is refused (fails closed). A
// closing ' or ’ must not be followed by a letter, so contractions
// ('my name's Ali') stay inside, except a short Uzbek suffix ('…'ni).
const CLOSERS: Record<string, string> = {
  "'": "'",
  '‘': '’',
  '"': '"',
  '“': '”',
  '„': '“',
  '«': '»',
}
const OPENS_HERE = /(?<![\p{L}\p{N}])(['‘"“„«])[ \t]*$/u
const SUFFIX =
  '(?:ni|ga|da|dan|ning|dagi|dir|lar|mi|cha|gacha|dek|day|lik|siz|ku|chi)?'
// A quoted example is one clause: a sentence end, a line break or a , ; :
// before the closer means the quote does not cover the phrase.
const SENTENCE_END = /[,;:]|[.?!…。！？](?=[^.?!…。！？])|[\n\r\u0085\u2028\u2029]/u

function quotedExampleAt(text: string, at: number): boolean {
  const open = OPENS_HERE.exec(text.slice(0, at))?.[1]
  if (!open) return false
  const close = CLOSERS[open]
  const closing = new RegExp(
    open === "'" || open === '‘' ? `${close}${SUFFIX}(?!\\p{L})` : close,
    'iu',
  ).exec(text.slice(at))
  return (
    closing !== null && !SENTENCE_END.test(text.slice(at, at + closing.index))
  )
}

// Every apostrophe an Uzbek keyboard produces; NFKC turns ´ into a space
// plus U+0301.
const APOSTROPHE = "(?:['’ʼʻ‘`]|\\u0301)"
// A full phrase, any spacing or case, ending at a word boundary, then any
// non-letters (spaces, digits, punctuation, symbols, emoji), then a letter
// (the name). The name part is a lookahead so a match never swallows the
// next phrase.
const NAME_PHRASE = new RegExp(
  `(?<![\\p{L}])(?:my\\s+name(?:\\s*${APOSTROPHE}\\s*s|\\s+is)|mening\\s+ismim|ismim|менинг\\s+исмим|исмим|меня\\s+зовут|мо[её]\\s+имя)(?![\\p{L}])(?=\\P{L}*\\p{L})`,
  'giu',
)

export function mentionsOwnName(raw: string): boolean {
  // Soft hyphens vanish; other invisible format characters act as spaces.
  const text = raw
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/\p{Cf}/gu, ' ')
  for (const m of text.matchAll(NAME_PHRASE)) {
    if (!quotedExampleAt(text, m.index)) return true
  }
  return false
}

export function stripPii(text: string): string {
  return PII_PATTERNS.reduce((out, re) => out.replace(re, REMOVED), text)
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
  // Reject before any regex runs: the scans are not linear on huge input.
  if (raw.length > MAX_QUESTION_CHARS) return null
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
