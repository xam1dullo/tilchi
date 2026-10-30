import { useRouter } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { ApiError, apiFetch } from '../lib/api'
import type { AttemptQuestion, AttemptRecord } from '../lib/attempt'
import {
  type GradeDraft,
  MAX_FEEDBACK,
  SPEAKING_MAX,
  emptyGrade,
  gradeBody,
  gradeError,
  gradeErrors,
  gradeTotal,
} from '../lib/grading'
import type { Copy } from '../lib/i18n'
import type { AppRole } from '../lib/nav'

type ErrorKey = keyof Copy

const attemptPath = (id: string) => `/api/attempts/${encodeURIComponent(id)}`

/** The manager view of an attempt: answers, key, recordings and the grade form. */
export function GradeAttempt({
  attempt,
  copy,
  previewRole,
}: {
  attempt: AttemptRecord
  copy: Copy
  previewRole: AppRole | null
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<GradeDraft>(emptyGrade)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<ErrorKey[]>([])
  const [tries, setTries] = useState(0)
  // Mirrors the server: only a submitted attempt is graded, and only once.
  const gradable = attempt.status === 'submitted'
  const { questions, recorded } = attempt

  async function save() {
    if (busy) return
    setTries((n) => n + 1)
    const invalid = gradeErrors(questions, recorded, draft)
    setErrors(invalid)
    if (invalid.length) return
    setBusy(true)
    try {
      await apiFetch(`${attemptPath(attempt.id)}/grade`, {
        method: 'POST',
        previewRole,
        body: JSON.stringify(gradeBody(questions, recorded, draft)),
      })
      await router.invalidate()
    } catch (failure) {
      const key = gradeError(failure)
      setErrors([key])
      if (key === 'gradeAlreadyGraded' || key === 'gradeNotSubmitted')
        await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="classroom-form catalog-form"
      aria-label={copy.gradeTitle}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      {attempt.status === 'assigned' || attempt.status === 'missed' ? (
        <p className="notice" data-tone="warn">
          {copy.gradeNotReady}
        </p>
      ) : null}
      <ol className="rows question-list">
        {questions.map((q) => (
          <li className="row question-row" key={q.id}>
            <GradeQuestion
              copy={copy}
              question={q}
              answer={attempt.answers[q.id] ?? []}
              recorded={recorded.includes(q.id)}
              editable={gradable}
              busy={busy}
              draft={draft}
              onChange={setDraft}
              player={
                <RecordingPlayer
                  copy={copy}
                  path={`${attemptPath(attempt.id)}/audio/${encodeURIComponent(q.id)}`}
                  previewRole={previewRole}
                />
              }
            />
          </li>
        ))}
      </ol>
      {gradable ? (
        <>
          <label>
            {copy.gradeFeedback}
            <textarea
              value={draft.feedback}
              maxLength={MAX_FEEDBACK}
              disabled={busy}
              onChange={(event) =>
                setDraft({ ...draft, feedback: event.target.value })
              }
            />
          </label>
          <div className="lesson-actions">
            <span>
              {copy.gradeTotal}{' '}
              <span className="num">
                {gradeTotal(questions, recorded, draft)} / {attempt.maxScore}
              </span>
            </span>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? copy.gradeSaving : copy.gradeSave}
            </button>
          </div>
        </>
      ) : null}
      {errors.map((key) => (
        <p
          key={`${tries}-${key}`}
          className="notice"
          data-tone="error"
          role="alert"
        >
          {copy[key]}
        </p>
      ))}
    </form>
  )
}

const optionTexts = (q: AttemptQuestion, ids: readonly string[]) =>
  (q.options ?? [])
    .filter((o) => ids.includes(o.id))
    .map((o) => o.text)
    .join(', ')

export function GradeQuestion({
  copy,
  question: q,
  answer,
  recorded,
  editable,
  busy,
  draft,
  onChange,
  player,
}: {
  copy: Copy
  question: AttemptQuestion
  answer: string[]
  recorded: boolean
  editable: boolean
  busy: boolean
  draft: GradeDraft
  onChange: (draft: GradeDraft) => void
  player: ReactNode
}) {
  const override = draft.overrides[q.id]
  return (
    <div className="question-view">
      <p className="question-prompt">{q.prompt}</p>
      {q.result ? (
        <p className="question-tags">
          <span className="tag">
            {copy.attemptScore}:{' '}
            <span className="num">
              {q.result.points} / {q.result.max}
            </span>
          </span>
        </p>
      ) : null}
      {q.type === 'speaking' ? (
        <>
          {recorded ? player : <p className="hint">{copy.recordMissing}</p>}
          {editable && recorded ? (
            <label>
              {copy.gradeSpeakingScore}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={SPEAKING_MAX}
                step={1}
                required
                disabled={busy}
                value={draft.speaking[q.id] ?? ''}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    speaking: { ...draft.speaking, [q.id]: event.target.value },
                  })
                }
              />
            </label>
          ) : null}
        </>
      ) : (
        <>
          <p>
            {copy.gradeLearnerAnswer}{' '}
            {answer.length ? optionTexts(q, answer) : copy.gradeNoAnswer}
          </p>
          <p>
            {copy.gradeCorrectAnswer} {optionTexts(q, q.answerKey ?? [])}
          </p>
          <p className="question-tags">
            <span className="tag">
              {q.autoCorrect ? copy.gradeAutoCorrect : copy.gradeAutoWrong}
            </span>
          </p>
          {editable ? (
            <label>
              {copy.gradeOverride}
              <select
                disabled={busy}
                value={override === undefined ? '' : String(override)}
                onChange={(event) => {
                  const { [q.id]: _, ...rest } = draft.overrides
                  const value = event.target.value
                  onChange({
                    ...draft,
                    overrides: value
                      ? { ...rest, [q.id]: value === 'true' }
                      : rest,
                  })
                }}
              >
                <option value="">{copy.gradeOverrideAuto}</option>
                <option value="true">{copy.gradeOverrideRight}</option>
                <option value="false">{copy.gradeOverrideWrong}</option>
              </select>
            </label>
          ) : null}
        </>
      )}
    </div>
  )
}

/** Asks for a short-lived playback url only when the teacher wants to listen. */
function RecordingPlayer({
  copy,
  path,
  previewRole,
}: {
  copy: Copy
  path: string
  previewRole: AppRole | null
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorKey | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const found = await apiFetch<{ url: string }>(path, { previewRole })
      setUrl(found.url)
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 404
          ? 'recordMissing'
          : 'error',
      )
    } finally {
      setLoading(false)
    }
  }

  if (url) {
    // The signed link expires; on a media error drop it so Listen fetches a fresh one.
    return (
      // biome-ignore lint/a11y/useMediaCaption: a learner's spoken answer, no captions exist
      <audio
        controls
        autoPlay
        src={url}
        onError={() => {
          setUrl(null)
          setError('error')
        }}
      />
    )
  }
  return (
    <div className="lesson-actions">
      <button
        type="button"
        className="btn btn-outline"
        disabled={loading}
        onClick={() => void load()}
      >
        {copy.gradeListen}
      </button>
      {error ? (
        <span className="hint" role="alert">
          {copy[error]}
        </span>
      ) : null}
    </div>
  )
}
