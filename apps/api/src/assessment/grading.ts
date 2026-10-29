import type { QuestionOption, QuestionResult } from '../db/schema'

/** A teacher scores each speaking answer from 0 to this; a choice is worth 1. */
export const SPEAKING_MAX = 5

export type TestQuestion = {
  id: string
  type: 'single' | 'multi' | 'speaking'
  prompt: string
  options: QuestionOption[] | null
  answerKey: string[] | null
}

export type GradeInput = {
  /** Speaking question id to 0..SPEAKING_MAX. */
  speaking: Record<string, number>
  /** Choice question id to the teacher's verdict, replacing the auto-check. */
  overrides: Record<string, boolean>
  feedback: string | null
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  b.every((x) => a.includes(x))

/**
 * Auto-check of a choice answer: single needs the one right option, multi
 * needs exactly the right set (no partial credit). A blank answer is wrong.
 */
export function isCorrect(question: TestQuestion, selected: string[] = []) {
  if (question.type === 'speaking' || !question.answerKey) return false
  return sameSet(selected, question.answerKey)
}

export const maxPoints = (question: Pick<TestQuestion, 'type'>) =>
  question.type === 'speaking' ? SPEAKING_MAX : 1

export const maxScore = (questions: Pick<TestQuestion, 'type'>[]) =>
  questions.reduce((sum, q) => sum + maxPoints(q), 0)

export type Graded =
  | {
      ok: true
      score: number
      max: number
      result: Record<string, QuestionResult>
    }
  | { ok: false; error: 'speaking_score_required' }

/**
 * Totals an attempt. A speaking question with a recording needs a teacher
 * score; one without a recording earns 0 and needs none.
 */
export function gradeAttempt(
  questions: TestQuestion[],
  answers: Record<string, string[]>,
  recorded: ReadonlySet<string>,
  input: GradeInput,
): Graded {
  const result: Record<string, QuestionResult> = {}
  for (const q of questions) {
    const max = maxPoints(q)
    if (q.type === 'speaking') {
      const given = input.speaking[q.id]
      if (!recorded.has(q.id)) {
        result[q.id] = { points: 0, max }
      } else if (given === undefined) {
        return { ok: false, error: 'speaking_score_required' }
      } else {
        result[q.id] = { points: given, max }
      }
    } else {
      const right = input.overrides[q.id] ?? isCorrect(q, answers[q.id])
      result[q.id] = { points: right ? 1 : 0, max }
    }
  }
  const score = Object.values(result).reduce((sum, r) => sum + r.points, 0)
  return { ok: true, score, max: maxScore(questions), result }
}
