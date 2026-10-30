import { ApiError } from './api'
import type { AttemptQuestion, AttemptRecord } from './attempt'
import type { Copy } from './i18n'

type ErrorKey = keyof Copy

// Mirrors apps/api/src/assessment/{grading,inputs}.ts, for UX only.
export const SPEAKING_MAX = 5
export const MAX_FEEDBACK = 2000

/** Speaking scores as typed, choice overrides, feedback text. */
export type GradeDraft = {
  speaking: Record<string, string>
  overrides: Record<string, boolean>
  feedback: string
}

export const emptyGrade = (): GradeDraft => ({
  speaking: {},
  overrides: {},
  feedback: '',
})

/** The server sends the key only to the group's teacher or an admin. */
export const isManagerView = (attempt: Pick<AttemptRecord, 'questions'>) =>
  attempt.questions.some((q) => 'answerKey' in q)

const points = (text: string | undefined) => {
  const value = Number(text?.trim())
  return text?.trim() && Number.isInteger(value) ? value : null
}

/**
 * Exactly what `parseGrade` accepts: scores only for recorded speaking
 * questions (an unrecorded one earns 0 and needs none), overrides only for
 * choice questions, feedback trimmed or null.
 */
export function gradeBody(
  questions: AttemptQuestion[],
  recorded: readonly string[],
  draft: GradeDraft,
) {
  const speaking: Record<string, number> = {}
  const overrides: Record<string, boolean> = {}
  for (const q of questions) {
    if (q.type === 'speaking') {
      const value = points(draft.speaking[q.id])
      if (recorded.includes(q.id) && value !== null) speaking[q.id] = value
    } else if (typeof draft.overrides[q.id] === 'boolean') {
      overrides[q.id] = draft.overrides[q.id]
    }
  }
  const feedback = draft.feedback.trim()
  return { speaking, overrides, feedback: feedback || null }
}

/** Copy keys of what to fix before saving; empty when the server would accept it. */
export function gradeErrors(
  questions: AttemptQuestion[],
  recorded: readonly string[],
  draft: GradeDraft,
): ErrorKey[] {
  const errors: ErrorKey[] = []
  const bad = questions.some((q) => {
    if (q.type !== 'speaking' || !recorded.includes(q.id)) return false
    const value = points(draft.speaking[q.id])
    return value === null || value < 0 || value > SPEAKING_MAX
  })
  if (bad) errors.push('gradeSpeakingInvalid')
  if (draft.feedback.trim().length > MAX_FEEDBACK)
    errors.push('gradeFeedbackInvalid')
  return errors
}

/** Points the save would give, as the server's `gradeAttempt` adds them up. */
export function gradeTotal(
  questions: AttemptQuestion[],
  recorded: readonly string[],
  draft: GradeDraft,
) {
  let total = 0
  for (const q of questions) {
    if (q.type === 'speaking') {
      const value = points(draft.speaking[q.id])
      if (recorded.includes(q.id) && value !== null)
        total += Math.min(Math.max(value, 0), SPEAKING_MAX)
    } else if (draft.overrides[q.id] ?? q.autoCorrect) {
      total += 1
    }
  }
  return total
}

const ERRORS: Record<string, ErrorKey> = {
  invalid_grade: 'gradeInvalid',
  invalid_feedback: 'gradeFeedbackInvalid',
  speaking_score_required: 'gradeSpeakingInvalid',
  already_graded: 'gradeAlreadyGraded',
  not_submitted: 'gradeNotSubmitted',
  not_found: 'attemptNotFound',
}

/** Copy key for a failed grade; 403 is "not allowed", unknown codes generic. */
export function gradeError(error: unknown): ErrorKey {
  if (error instanceof ApiError && error.status === 403) return 'gradeForbidden'
  return error instanceof Error && Object.hasOwn(ERRORS, error.message)
    ? ERRORS[error.message]
    : 'courseUnavailable'
}
