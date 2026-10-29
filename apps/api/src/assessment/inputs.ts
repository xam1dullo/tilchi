import { HttpException } from '@nestjs/common'
import type { QuestionOption } from '../db/schema'
import { isUuid } from '../db/uuid'
import {
  AUDIO_TYPES,
  type AudioType,
  MAX_AUDIO_BYTES,
} from '../storage/object-storage'
import { type GradeInput, SPEAKING_MAX, type TestQuestion } from './grading'

const invalid = (error: string): never => {
  throw new HttpException({ error }, 400)
}

type Obj = Record<string, unknown>
const object = (body: unknown, error: string): Obj =>
  body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Obj)
    : invalid(error)

/** Refuses fields we do not know, so a typo is an error and not a silent no-op. */
function only(input: Obj, keys: string[], error: string) {
  if (Object.keys(input).some((key) => !keys.includes(key))) invalid(error)
}

const text = (value: unknown, max: number, error: string) =>
  typeof value === 'string' && value.trim() && value.trim().length <= max
    ? value.trim()
    : invalid(error)

/** A year ahead is plenty, and keeps absurd dates away from Postgres. */
const MAX_DEADLINE_MS = 366 * 24 * 3_600_000
export const MAX_OPTIONS = 8
export const MAX_TEST_QUESTIONS = 50
const OPTION_IDS = 'abcdefgh'

export type QuestionDraft = {
  type: TestQuestion['type']
  prompt: string
  options: QuestionOption[] | null
  answerKey: string[] | null
}

const isIndex = (value: unknown, below: number) =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) < below

function parseOptions(optionTexts: unknown): QuestionOption[] {
  if (
    !Array.isArray(optionTexts) ||
    optionTexts.length < 2 ||
    optionTexts.length > MAX_OPTIONS
  ) {
    return invalid('invalid_options')
  }
  return optionTexts.map((t, i) => ({
    id: OPTION_IDS[i],
    text: text(t, 300, 'invalid_options'),
  }))
}

/** Options arrive as texts and the key as indexes; the server names the options a, b, c... */
function choice(
  type: 'single' | 'multi',
  optionTexts: unknown,
  correct: unknown,
) {
  const options = parseOptions(optionTexts)
  if (
    !Array.isArray(correct) ||
    correct.length === 0 ||
    (type === 'single' && correct.length !== 1) ||
    new Set(correct).size !== correct.length ||
    !correct.every((c) => isIndex(c, options.length))
  ) {
    return invalid('invalid_answer_key')
  }
  const answerKey = (correct as number[]).map((c) => options[c].id).sort()
  return { options, answerKey }
}

export function parseNewQuestion(body: unknown): QuestionDraft {
  const input = object(body, 'invalid_question')
  only(input, ['type', 'prompt', 'options', 'correct'], 'invalid_question')
  const prompt = text(input.prompt, 2000, 'invalid_prompt')
  if (input.type === 'speaking') {
    if ('options' in input || 'correct' in input) invalid('invalid_question')
    return { type: 'speaking', prompt, options: null, answerKey: null }
  }
  if (input.type !== 'single' && input.type !== 'multi') {
    return invalid('invalid_type')
  }
  return {
    type: input.type,
    prompt,
    ...choice(input.type, input.options, input.correct),
  }
}

export type QuestionPatch = {
  prompt?: string
  options?: QuestionOption[]
  answerKey?: string[]
  publish: boolean
}

/** A draft may change its text, options and key (together) or be published. */
export function parseQuestionPatch(
  body: unknown,
  existing: Pick<TestQuestion, 'type' | 'options' | 'answerKey'>,
): QuestionPatch {
  const input = object(body, 'invalid_question')
  only(input, ['prompt', 'options', 'correct', 'status'], 'invalid_question')
  if (Object.keys(input).length === 0) invalid('invalid_question')
  const patch: QuestionPatch = { publish: false }
  if ('prompt' in input) {
    patch.prompt = text(input.prompt, 2000, 'invalid_prompt')
  }
  if ('options' in input || 'correct' in input) {
    Object.assign(patch, choicePatch(input, existing.type))
  }
  if ('status' in input) {
    if (input.status !== 'published') invalid('invalid_status')
    patch.publish = true
  }
  return patch
}

function choicePatch(input: Obj, type: TestQuestion['type']) {
  if (type === 'speaking' || !('options' in input) || !('correct' in input)) {
    return invalid('invalid_question')
  }
  return choice(type, input.options, input.correct)
}

export function parseTest(body: unknown) {
  const input = object(body, 'invalid_test')
  only(input, ['title', 'questionIds'], 'invalid_test')
  const title = text(input.title, 120, 'invalid_title')
  const ids = input.questionIds
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_TEST_QUESTIONS ||
    ids.some((id) => typeof id !== 'string' || !isUuid(id)) ||
    new Set(ids).size !== ids.length
  ) {
    invalid('invalid_questions')
  }
  return { title, questionIds: ids as string[] }
}

export function parseAssign(body: unknown, now: Date) {
  const input = object(body, 'invalid_assignment')
  only(input, ['testId', 'deadline'], 'invalid_assignment')
  if (typeof input.testId !== 'string' || !isUuid(input.testId)) {
    invalid('invalid_test_id')
  }
  const deadline =
    typeof input.deadline === 'string' ? new Date(input.deadline) : null
  if (
    !deadline ||
    Number.isNaN(deadline.getTime()) ||
    deadline <= now ||
    deadline.getTime() > now.getTime() + MAX_DEADLINE_MS
  ) {
    invalid('invalid_deadline')
  }
  return { testId: input.testId as string, deadline: deadline as Date }
}

const hasDuplicates = (values: unknown[]) =>
  new Set(values).size !== values.length

function badSelection(q: TestQuestion, selected: unknown[]) {
  const ids = q.options?.map((o) => o.id)
  return (
    selected.some((s) => !ids?.includes(s as string)) ||
    (q.type === 'single' && selected.length > 1) ||
    hasDuplicates(selected)
  )
}

function parseSelection(q: TestQuestion | undefined, selected: unknown) {
  if (
    !q ||
    q.type === 'speaking' ||
    !Array.isArray(selected) ||
    badSelection(q, selected)
  ) {
    return invalid('invalid_answers')
  }
  return [...(selected as string[])].sort()
}

/** Choice answers only; every id must exist, and a single question takes one option. */
export function parseAnswers(body: unknown, questions: TestQuestion[]) {
  const input = object(body, 'invalid_answers')
  only(input, ['answers'], 'invalid_answers')
  const raw = object(input.answers, 'invalid_answers')
  const answers: Record<string, string[]> = {}
  for (const [id, selected] of Object.entries(raw)) {
    answers[id] = parseSelection(
      questions.find((x) => x.id === id),
      selected,
    )
  }
  return answers
}

export function parsePresign(body: unknown) {
  const input = object(body, 'invalid_audio')
  only(input, ['questionId', 'contentType', 'size'], 'invalid_audio')
  if (typeof input.questionId !== 'string' || !isUuid(input.questionId)) {
    invalid('invalid_audio')
  }
  if (
    typeof input.contentType !== 'string' ||
    !Object.hasOwn(AUDIO_TYPES, input.contentType)
  ) {
    invalid('unsupported_audio_type')
  }
  if (
    !Number.isInteger(input.size) ||
    (input.size as number) < 1 ||
    (input.size as number) > MAX_AUDIO_BYTES
  ) {
    invalid('audio_too_large')
  }
  return {
    questionId: input.questionId as string,
    contentType: input.contentType as AudioType,
    size: input.size as number,
  }
}

const optional = (value: unknown) =>
  value === undefined ? {} : object(value, 'invalid_grade')

function parseSpeaking(raw: Obj, questions: TestQuestion[]) {
  const speaking: Record<string, number> = {}
  for (const [id, points] of Object.entries(raw)) {
    const q = questions.find((x) => x.id === id)
    if (q?.type !== 'speaking' || !isPoints(points)) invalid('invalid_grade')
    speaking[id] = points as number
  }
  return speaking
}

const isPoints = (value: unknown) =>
  Number.isInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= SPEAKING_MAX

function parseOverrides(raw: Obj, questions: TestQuestion[]) {
  const overrides: Record<string, boolean> = {}
  for (const [id, right] of Object.entries(raw)) {
    const q = questions.find((x) => x.id === id)
    if (!q || q.type === 'speaking' || typeof right !== 'boolean') {
      invalid('invalid_grade')
    }
    overrides[id] = right as boolean
  }
  return overrides
}

export function parseGrade(
  body: unknown,
  questions: TestQuestion[],
): GradeInput {
  const input = object(body, 'invalid_grade')
  only(input, ['speaking', 'overrides', 'feedback'], 'invalid_grade')
  const empty = input.feedback === undefined || input.feedback === null
  return {
    speaking: parseSpeaking(optional(input.speaking), questions),
    overrides: parseOverrides(optional(input.overrides), questions),
    feedback: empty ? null : text(input.feedback, 2000, 'invalid_feedback'),
  }
}
