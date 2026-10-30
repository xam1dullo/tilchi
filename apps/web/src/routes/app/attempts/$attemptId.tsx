import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { Suspense, lazy, useState } from 'react'
import { RetryButton } from '../../../components/retry-button'
import { ApiError, apiFetch } from '../../../lib/api'
import { statusKey } from '../../../lib/assignments'
import {
  type AttemptRecord,
  type AudioType,
  type Upload,
  answersBody,
  attemptError,
  canSubmit,
  pick,
  uploadAudio,
} from '../../../lib/attempt'
import {
  AttemptQuestionView,
  AttemptSummary,
} from '../../../components/attempt-view'
import { formatLessonTime } from '../../../lib/classroom'
import { type Copy, messages } from '../../../lib/i18n'
import { keepAppSearch } from '../../../lib/preview'

const SpeakingRecorder = lazy(
  () => import('../../../components/speaking-recorder'),
)

export const Route = createFileRoute('/app/attempts/$attemptId')({
  loader: ({ context: { previewRole }, params }) =>
    apiFetch<AttemptRecord>(attemptPath(params.attemptId), { previewRole }),
  component: AttemptPage,
  errorComponent: AttemptError,
})

const attemptPath = (id: string) => `/api/attempts/${encodeURIComponent(id)}`

function AttemptError({ error }: { error: unknown }) {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const copy = messages(locale)
  const gone = error instanceof ApiError && [403, 404].includes(error.status)
  return (
    <div role="alert" className="error-row">
      <p>{copy[gone ? attemptError(error) : 'error']}</p>
      {gone ? (
        <Link
          className="btn btn-outline"
          to="/app/assignments"
          search={keepAppSearch(previewRole)}
        >
          {copy.myTests}
        </Link>
      ) : (
        <RetryButton label={copy.retry} />
      )}
    </div>
  )
}

function AttemptPage() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const attempt = Route.useLoaderData()
  const copy = messages(locale)
  const router = useRouter()
  const open = attempt.status === 'assigned'
  const [draft, setDraft] = useState(attempt.answers)
  const [recorded, setRecorded] = useState(attempt.recorded)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<keyof Copy | null>(null)
  const [tries, setTries] = useState(0)
  const ready = canSubmit(attempt.questions, draft, recorded)
  // Once closed, show what the server kept, not what this page last held.
  const answers = open ? draft : attempt.answers
  const kept = open ? recorded : attempt.recorded

  async function upload(questionId: string, blob: Blob, type: AudioType) {
    try {
      await uploadAudio(
        fetch,
        (body) =>
          apiFetch<Upload>(`${attemptPath(attempt.id)}/audio/presign`, {
            method: 'POST',
            previewRole,
            body: JSON.stringify(body),
          }),
        questionId,
        blob,
        type,
      )
      setRecorded((ids) => [...new Set([...ids, questionId])])
      return null
    } catch (failure) {
      // The server points at the new take as soon as it presigns, so a failed
      // upload leaves no usable recording either way.
      setRecorded((ids) => ids.filter((id) => id !== questionId))
      return attemptError(failure)
    }
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    setTries((n) => n + 1)
    try {
      await apiFetch(`${attemptPath(attempt.id)}/submit`, {
        method: 'POST',
        previewRole,
        body: JSON.stringify(answersBody(attempt.questions, draft)),
      })
      await router.invalidate()
    } catch (failure) {
      const key = attemptError(failure)
      setError(key)
      if (key === 'attemptAlreadySubmitted' || key === 'attemptDeadlinePassed')
        await router.invalidate()
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <section className="classroom" aria-labelledby="attempt-heading">
      <p className="eyebrow">
        <Link to="/app/assignments" search={keepAppSearch(previewRole)}>
          {copy.myTests}
        </Link>
      </p>
      <div className="classroom-head">
        <div>
          <h2 id="attempt-heading">{attempt.title}</h2>
          <p className="hint">
            <span className="tag">{copy[statusKey[attempt.status]]}</span>{' '}
            {copy.assignmentDeadline}{' '}
            {formatLessonTime(attempt.deadline, locale)}
          </p>
        </div>
      </div>
      <AttemptSummary attempt={attempt} copy={copy} />
      {error ? (
        <p key={tries} className="notice" data-tone="error" role="alert">
          {copy[error]}
        </p>
      ) : null}
      <form
        className="classroom-form catalog-form"
        aria-labelledby="attempt-heading"
        onSubmit={(event) => {
          event.preventDefault()
          if (ready) setConfirming(true)
        }}
      >
        <fieldset className="question-lock" disabled={busy || !open}>
          <ol className="rows question-list">
            {attempt.questions.map((q) => (
              <li className="row question-row" key={q.id}>
                <AttemptQuestionView
                  copy={copy}
                  question={q}
                  picked={answers[q.id] ?? []}
                  onPick={(id) => setDraft((d) => pick(d, q, id))}
                />
                {q.type === 'speaking' ? (
                  open ? (
                    <Suspense
                      fallback={<p className="hint">{copy.recordLoading}</p>}
                    >
                      <SpeakingRecorder
                        copy={copy}
                        recorded={recorded.includes(q.id)}
                        onUpload={(blob, type) => upload(q.id, blob, type)}
                      />
                    </Suspense>
                  ) : (
                    <p className="hint">
                      {kept.includes(q.id)
                        ? copy.recordSaved
                        : copy.recordMissing}
                    </p>
                  )
                ) : null}
              </li>
            ))}
          </ol>
          {open ? (
            <div className="lesson-actions">
              {confirming ? (
                <>
                  <span>{copy.attemptSubmitPrompt}</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void submit()}
                  >
                    {busy ? copy.attemptSubmitting : copy.attemptSubmitConfirm}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setConfirming(false)}
                  >
                    {copy.courseCancel}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!ready}
                    aria-describedby={ready ? undefined : 'attempt-incomplete'}
                  >
                    {copy.attemptSubmit}
                  </button>
                  {ready ? null : (
                    <span id="attempt-incomplete" className="hint">
                      {copy.attemptIncomplete}
                    </span>
                  )}
                </>
              )}
            </div>
          ) : null}
        </fieldset>
      </form>
    </section>
  )
}
