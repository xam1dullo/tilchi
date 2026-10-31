import { ApiError } from './api'
import type { Copy } from './i18n'

export type QuestionType = 'single' | 'multi' | 'speaking'
export type QuestionStatus = 'draft' | 'published'

/** A bank question as the API returns it to a manager (with the key). */
export type QuestionRecord = {
  id: string
  type: QuestionType
  prompt: string
  options: { id: string; text: string }[] | null
  answerKey: string[] | null
  status: QuestionStatus
}

export type TestSummary = {
  id: string
  title: string
  createdAt: string
  questionCount: number
}

export type TestRecord = {
  id: string
  title: string
  createdAt: string
  maxScore: number
  questions: QuestionRecord[]
}

/** The form's state: option texts and the indexes of the correct ones. */
export type QuestionDraft = {
  type: QuestionType
  prompt: string
  options: string[]
  correct: number[]
}

// Mirrors apps/api/src/assessment/inputs.ts, for UX only; the server decides.
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 8
export const MAX_PROMPT = 2000
export const MAX_OPTION = 300
export const MAX_TITLE = 120
export const MAX_TEST_QUESTIONS = 50

export function emptyDraft(type: QuestionType = 'single'): QuestionDraft {
  return {
    type,
    prompt: '',
    options: type === 'speaking' ? [] : ['', ''],
    correct: [],
  }
}

/** Speaking drops the options; single keeps at most one correct answer. */
export function withType(draft: QuestionDraft, type: QuestionType) {
  if (type === 'speaking') return { ...draft, type, options: [], correct: [] }
  const options = draft.options.length ? draft.options : ['', '']
  const correct = type === 'single' ? draft.correct.slice(0, 1) : draft.correct
  return { ...draft, type, options, correct }
}

export function addOption(draft: QuestionDraft): QuestionDraft {
  if (draft.options.length >= MAX_OPTIONS) return draft
  return { ...draft, options: [...draft.options, ''] }
}

/** Removing an option shifts the correct indexes after it down by one. */
export function removeOption(draft: QuestionDraft, index: number) {
  if (draft.options.length <= MIN_OPTIONS) return draft
  return {
    ...draft,
    options: draft.options.filter((_, i) => i !== index),
    correct: draft.correct
      .filter((c) => c !== index)
      .map((c) => (c > index ? c - 1 : c)),
  }
}

export function setOption(draft: QuestionDraft, index: number, text: string) {
  return {
    ...draft,
    options: draft.options.map((o, i) => (i === index ? text : o)),
  }
}

export function toggleCorrect(draft: QuestionDraft, index: number) {
  if (draft.type === 'single') return { ...draft, correct: [index] }
  const correct = draft.correct.includes(index)
    ? draft.correct.filter((c) => c !== index)
    : [...draft.correct, index].sort((a, b) => a - b)
  return { ...draft, correct }
}

export function draftFromQuestion(q: QuestionRecord): QuestionDraft {
  const options = q.options ?? []
  return {
    type: q.type,
    prompt: q.prompt,
    options: options.map((o) => o.text),
    correct: options
      .map((o, i) => (q.answerKey?.includes(o.id) ? i : -1))
      .filter((i) => i >= 0),
  }
}

type ErrorKey = keyof Copy

/** Client checks, so the user sees the problem before a round trip. */
export function draftErrors(draft: QuestionDraft): ErrorKey[] {
  const errors: ErrorKey[] = []
  const prompt = draft.prompt.trim()
  if (!prompt || prompt.length > MAX_PROMPT)
    errors.push('questionPromptInvalid')
  if (draft.type === 'speaking') return errors
  const { options, correct } = draft
  if (
    options.length < MIN_OPTIONS ||
    options.length > MAX_OPTIONS ||
    options.some((o) => !o.trim() || o.trim().length > MAX_OPTION)
  ) {
    errors.push('questionOptionsInvalid')
  }
  if (correct.length === 0 || (draft.type === 'single' && correct.length !== 1))
    errors.push('questionKeyInvalid')
  return errors
}

export function toQuestionBody(draft: QuestionDraft) {
  const prompt = draft.prompt.trim()
  if (draft.type === 'speaking') return { type: draft.type, prompt }
  return {
    type: draft.type,
    prompt,
    options: draft.options.map((o) => o.trim()),
    correct: [...draft.correct].sort((a, b) => a - b),
  }
}

const choiceKey = (body: ReturnType<typeof toQuestionBody>) =>
  'options' in body ? JSON.stringify([body.options, body.correct]) : ''

/**
 * Only what changed; the API wants options and correct together.
 * Null when nothing changed (the API refuses an empty patch).
 */
export function toQuestionPatch(
  draft: QuestionDraft,
  original: QuestionRecord,
) {
  const body = toQuestionBody(draft)
  const before = toQuestionBody(draftFromQuestion(original))
  const patch: { prompt?: string; options?: string[]; correct?: number[] } = {}
  if (body.prompt !== before.prompt) patch.prompt = body.prompt
  if ('options' in body && choiceKey(body) !== choiceKey(before)) {
    patch.options = body.options
    patch.correct = body.correct
  }
  return Object.keys(patch).length ? patch : null
}

const ERRORS: Record<string, ErrorKey> = {
  invalid_prompt: 'questionPromptInvalid',
  invalid_options: 'questionOptionsInvalid',
  invalid_answer_key: 'questionKeyInvalid',
  not_draft: 'questionNotDraft',
  in_use: 'questionInUse',
  not_found: 'questionNotFound',
  invalid_title: 'testTitleInvalid',
  invalid_questions: 'testQuestionsInvalid',
  invalid_question: 'questionInvalid',
  invalid_type: 'questionTypeInvalid',
  invalid_status: 'questionStatusInvalid',
  invalid_test: 'testInvalid',
}

/** Copy key for a failed bank request; unknown codes get the generic one. */
export function bankError(error: unknown): ErrorKey {
  return (
    (error instanceof Error && Object.hasOwn(ERRORS, error.message)
      ? ERRORS[error.message]
      : undefined) ?? 'courseUnavailable'
  )
}

export function filterQuestions(
  questions: QuestionRecord[],
  status: QuestionStatus | 'all',
) {
  return status === 'all'
    ? questions
    : questions.filter((q) => q.status === status)
}

/** Picked ids keep the order they were picked in: that is the test's order. */
export function togglePick(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

export function testErrors(title: string, ids: string[]): ErrorKey[] {
  const errors: ErrorKey[] = []
  const t = title.trim()
  if (!t || t.length > MAX_TITLE) errors.push('testTitleInvalid')
  if (ids.length === 0 || ids.length > MAX_TEST_QUESTIONS)
    errors.push('testQuestionsInvalid')
  return errors
}

export function toTestBody(title: string, ids: string[]) {
  return { title: title.trim(), questionIds: ids }
}

export type RowConfirm = { id: string; action: 'publish' | 'delete' } | null

/**
 * What a bank row offers. Any question may be deleted (the server refuses one
 * in use); only drafts are edited or published, and never the one open in the
 * editor, which would publish the stored text and drop the unsaved edits.
 */
export function questionRowView(
  q: QuestionRecord,
  editingId: string | null,
  confirm: RowConfirm,
) {
  const draft = q.status === 'draft'
  return {
    edit: draft,
    publish: draft,
    publishBlocked: draft && editingId === q.id,
    confirming: confirm?.id === q.id ? confirm.action : null,
  }
}

/** Copy key for a failed test page load: 404 is "not found", the rest generic. */
export function testLoadError(error: unknown): ErrorKey {
  return error instanceof ApiError && error.status === 404
    ? 'testNotFound'
    : 'error'
}

/** What the form was a render ago: open or not, and which question it edited. */
export type FormState = { open: boolean; editId: string | null }

/** Where focus lands when a collapsible form closes. */
export type CloseFocus = { edit: string } | 'new' | null

/**
 * Null unless the form just closed (so first render and open → open move
 * nothing). An edit hands focus back to that row's Edit button while the row
 * is still listed; otherwise focus returns to the New button.
 */
export function focusAfterClose(
  before: FormState,
  open: boolean,
  listedIds: readonly string[],
): CloseFocus {
  if (!before.open || open) return null
  if (before.editId && listedIds.includes(before.editId)) {
    return { edit: before.editId }
  }
  return 'new'
}
