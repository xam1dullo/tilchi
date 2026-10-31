import { redirect } from '@tanstack/react-router'
import { type ReactNode, type Ref, useEffect, useRef } from 'react'
import { apiFetch } from '../lib/api'
import type { Copy } from '../lib/i18n'
import type { AppRole } from '../lib/nav'
import { keepAppSearch } from '../lib/preview'
import {
  addOption,
  MAX_OPTION,
  MAX_OPTIONS,
  MAX_PROMPT,
  MIN_OPTIONS,
  type QuestionDraft,
  type QuestionRecord,
  type QuestionType,
  removeOption,
  setOption,
  toggleCorrect,
  withType,
} from '../lib/question-form'

export type QuestionFormProps = {
  copy: Copy
  draft: QuestionDraft
  editing: boolean
  /** Any request in flight: the controls freeze so no edit is lost. */
  locked: boolean
  /** This form's own save is in flight. */
  saving: boolean
  errors: (keyof Copy)[]
  /** Bumped on every submit so the same alert is announced again. */
  attempt: number
  promptRef?: Ref<HTMLTextAreaElement>
  onChange: (draft: QuestionDraft) => void
  onSubmit: () => void
  onCancel: () => void
}

const TYPES: [QuestionType, keyof Copy][] = [
  ['single', 'questionTypeSingle'],
  ['multi', 'questionTypeMulti'],
  ['speaking', 'questionTypeSpeaking'],
]

/** Painting only: state and requests live in the route. */
export function QuestionForm({
  copy,
  draft,
  editing,
  locked,
  saving,
  errors,
  attempt,
  promptRef,
  onChange,
  onSubmit,
  onCancel,
}: QuestionFormProps) {
  return (
    <form
      className="classroom-form catalog-form question-form"
      aria-labelledby="question-form-heading"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <h3 id="question-form-heading">
        {editing ? copy.questionEditTitle : copy.questionNew}
      </h3>
      <fieldset className="question-lock" disabled={locked}>
        <label>
          {copy.questionType}
          <select
            value={draft.type}
            disabled={editing}
            onChange={(event) =>
              onChange(withType(draft, event.target.value as QuestionType))
            }
          >
            {TYPES.map(([type, key]) => (
              <option key={type} value={type}>
                {copy[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="question-wide">
          {copy.questionPrompt}
          <textarea
            ref={promptRef}
            value={draft.prompt}
            maxLength={MAX_PROMPT}
            required
            onChange={(event) =>
              onChange({ ...draft, prompt: event.target.value })
            }
          />
        </label>
        {draft.type === 'speaking' ? null : (
          <fieldset className="question-wide question-options">
            <legend>{copy.questionOptions}</legend>
            {draft.options.map((text, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: options have no id until saved
              <div className="question-option" key={index}>
                <label>
                  <span>
                    {copy.questionOption} {index + 1}
                  </span>
                  <input
                    value={text}
                    maxLength={MAX_OPTION}
                    required
                    onChange={(event) =>
                      onChange(setOption(draft, index, event.target.value))
                    }
                  />
                </label>
                <label className="catalog-publish">
                  <input
                    aria-label={`${copy.questionCorrect}: ${copy.questionOption} ${index + 1}`}
                    type={draft.type === 'single' ? 'radio' : 'checkbox'}
                    name="correct"
                    checked={draft.correct.includes(index)}
                    onChange={() => onChange(toggleCorrect(draft, index))}
                  />{' '}
                  {copy.questionCorrect}
                </label>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={draft.options.length <= MIN_OPTIONS}
                  aria-label={`${copy.questionRemoveOption}: ${copy.questionOption} ${index + 1}`}
                  onClick={() => onChange(removeOption(draft, index))}
                >
                  {copy.questionRemoveOption}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline"
              disabled={draft.options.length >= MAX_OPTIONS}
              onClick={() => onChange(addOption(draft))}
            >
              {copy.questionAddOption}
            </button>
          </fieldset>
        )}
        <div className="lesson-actions question-wide">
          <button className="btn btn-primary" type="submit">
            {saving
              ? copy.courseSaving
              : editing
                ? copy.courseSave
                : copy.questionCreate}
          </button>
          <button className="btn btn-outline" type="button" onClick={onCancel}>
            {copy.courseCancel}
          </button>
        </div>
      </fieldset>
      {errors.map((key) => (
        <p
          key={`${attempt}-${key}`}
          className="notice question-wide"
          data-tone="error"
          role="alert"
        >
          {copy[key]}
        </p>
      ))}
    </form>
  )
}

/**
 * A form kept behind one button. Closed, only the button shows; open, the
 * form takes its place. Closing hands focus back to the button.
 */
export function Collapsible({
  open,
  label,
  primary = false,
  onOpen,
  children,
}: {
  open: boolean
  label: string
  primary?: boolean
  onOpen: () => void
  children?: ReactNode
}) {
  const button = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus()
    wasOpen.current = open
  }, [open])
  if (open) return children
  return (
    <button
      ref={button}
      type="button"
      className={`btn ${primary ? 'btn-primary' : 'btn-outline'} collapsible-open`}
      onClick={onOpen}
    >
      {label}
    </button>
  )
}

/** The page is for whoever the server lets manage tests; others see /app/forbidden. */
export async function requireManageTests(previewRole: AppRole | null) {
  const { can } = await apiFetch<{ can: { manageTests?: boolean } }>(
    '/api/groups',
    { previewRole },
  )
  if (!can.manageTests) {
    throw redirect({ to: '/app/forbidden', search: keepAppSearch(previewRole) })
  }
}

const typeKey = {
  single: 'questionTypeSingle',
  multi: 'questionTypeMulti',
  speaking: 'questionTypeSpeaking',
} as const

/** One question with its type, status and the correct options marked. */
export function QuestionView({
  copy,
  question,
}: {
  copy: Copy
  question: QuestionRecord
}) {
  return (
    <div className="question-view">
      <p className="question-tags">
        <span className="tag question-type">
          {copy[typeKey[question.type]]}
        </span>{' '}
        <span className="tag" data-status={question.status}>
          {question.status === 'published'
            ? copy.coursePublished
            : copy.courseDraft}
        </span>
      </p>
      <p className="question-prompt">{question.prompt}</p>
      {question.options ? (
        <ul className="question-answers">
          {question.options.map((option) => {
            const right = question.answerKey?.includes(option.id) ?? false
            return (
              <li key={option.id} data-correct={right}>
                {option.text}
                {right ? (
                  <span className="question-correct">
                    {' '}
                    ({copy.questionCorrect})
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
