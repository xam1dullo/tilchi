import { redirect } from '@tanstack/react-router'
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
  busy: boolean
  errors: (keyof Copy)[]
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
  busy,
  errors,
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
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy
            ? copy.courseSaving
            : editing
              ? copy.courseSave
              : copy.questionCreate}
        </button>
        {editing ? (
          <button
            className="btn btn-outline"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            {copy.courseCancel}
          </button>
        ) : null}
      </div>
      {errors.map((key) => (
        <p
          key={key}
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
        <span className="tag">{copy[typeKey[question.type]]}</span>{' '}
        <span className="tag">
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
