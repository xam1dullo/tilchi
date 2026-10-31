import { AppNotFound } from '../../app'
import { loadForSession, sessionData } from '../../../lib/session'
import {
  Link,
  createFileRoute,
  useRouteContext,
  useRouter,
} from '@tanstack/react-router'
import { Suspense, lazy, useState } from 'react'
import { GradeAttempt } from '../../../components/grade-attempt'
import { RetryButton } from '../../../components/retry-button'
import { ApiError, apiFetch, loadDetail } from '../../../lib/api'
import { statusKey } from '../../../lib/assignments'
import {
  type AttemptRecord,
  type AudioType,
  type Upload,
  answersBody,
  attemptError,
  attemptFallback,
  canSubmit,
  markActive,
  pick,
  uploadAudio,
} from '../../../lib/attempt'
import {
  AttemptIdentity,
  AttemptQuestionView,
  AttemptSummary,
} from '../../../components/attempt-view'
import { formatLessonTime } from '../../../lib/classroom'
import { isManagerView } from '../../../lib/grading'
import { type Copy, messages } from '../../../lib/i18n'
import { keepAppSearch } from '../../../lib/preview'

const SpeakingRecorder = lazy(
  () => import('../../../components/speaking-recorder'),
)

export const Route = createFileRoute('/app/attempts/$attemptId')({
  loader: ({ context: { previewRole, session }, params }) =>
    loadForSession(session, () =>
      loadDetail(() =>
        apiFetch<AttemptRecord>(attemptPath(params.attemptId), { previewRole }),
      ),
    ),
  notFoundComponent: AppNotFound,
  component: AttemptPage,
  errorComponent: AttemptError,
})

const attemptPath = (id: string) => `/api/attempts/${encodeURIComponent(id)}`

function AttemptError({ error }: { error: unknown }) {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole, session } = useRouteContext({ from: '/app' })
  const fallback = attemptFallback(session?.role)
  const copy = messages(locale)
  const gone = error instanceof ApiError && error.status === 403
  return (
    <div role="alert" className="error-row">
      <p>{copy[gone ? attemptError(error) : 'error']}</p>
      {gone ? (
        <Link
          className="btn btn-outline"
          to={fallback.to}
          search={keepAppSearch(previewRole)}
        >
          {copy[fallback.label]}
        </Link>
      ) : (
        <RetryButton label={copy.retry} />
      )}
    </div>
  )
}

function AttemptPage() {
  const attempt = sessionData(Route.useLoaderData())
  return isManagerView(attempt) ? <ManagerAttempt /> : <LearnerAttempt />
}

function AttemptHead({
  attempt,
  copy,
}: {
  attempt: AttemptRecord
  copy: Copy
}) {
  const { locale } = useRouteContext({ from: '__root__' })
  return (
    <div className="classroom-head">
      <div>
        <h2 id="attempt-heading">{attempt.title}</h2>
        <p className="hint">
          <span className="tag">{copy[statusKey[attempt.status]]}</span>{' '}
          {copy.assignmentDeadline} {formatLessonTime(attempt.deadline, locale)}
        </p>
      </div>
    </div>
  )
}

function ManagerAttempt() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const attempt = sessionData(Route.useLoaderData())
  const copy = messages(locale)
  return (
    <section className="classroom grade-page" aria-labelledby="attempt-heading">
      <AttemptIdentity
        name={attempt.learnerName ?? undefined}
        groupId={attempt.groupId}
        copy={copy}
        previewRole={previewRole}
      />
      <AttemptHead attempt={attempt} copy={copy} />
      {attempt.status === 'graded' ? (
        <AttemptSummary attempt={attempt} copy={copy} />
      ) : null}
      <GradeAttempt attempt={attempt} copy={copy} previewRole={previewRole} />
    </section>
  )
}

function LearnerAttempt() {
  const { locale } = useRouteContext({ from: '__root__' })
  const { previewRole } = useRouteContext({ from: '/app' })
  const attempt = sessionData(Route.useLoaderData())
  const copy = messages(locale)
  const router = useRouter()
  const open = attempt.status === 'assigned'
  const [draft, setDraft] = useState(attempt.answers)
  const [recorded, setRecorded] = useState(attempt.recorded)
  const [active, setActive] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<keyof Copy | null>(null)
  const [tries, setTries] = useState(0)
  const ready = canSubmit(attempt.questions, draft, recorded, active)
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
        () => setRecorded((ids) => ids.filter((id) => id !== questionId)),
      )
      setRecorded((ids) => [...new Set([...ids, questionId])])
      return null
    } catch (failure) {
      return attemptError(failure)
    }
  }

  async function submit() {
    if (busy || !ready) return
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
    <section
      className="classroom attempt-page"
      aria-labelledby="attempt-heading"
    >
      <p className="eyebrow">
        <Link to="/app/assignments" search={keepAppSearch(previewRole)}>
          {copy.myTests}
        </Link>
      </p>
      <AttemptHead attempt={attempt} copy={copy} />
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
            {attempt.questions.map((q, index) => (
              <li className="row question-row" key={q.id}>
                <span className="attempt-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
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
                        onActive={(on) =>
                          setActive((ids) => markActive(ids, q.id, on))
                        }
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
            <div className="lesson-actions attempt-submit">
              {confirming ? (
                <>
                  <span>{copy.attemptSubmitPrompt}</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!ready}
                    aria-describedby={ready ? undefined : 'attempt-blocked'}
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!ready}
                  aria-describedby={ready ? undefined : 'attempt-blocked'}
                >
                  {copy.attemptSubmit}
                </button>
              )}
              {ready ? null : (
                <span id="attempt-blocked" className="hint">
                  {active.length > 0
                    ? copy.attemptRecorderBusy
                    : copy.attemptIncomplete}
                </span>
              )}
            </div>
          ) : null}
        </fieldset>
      </form>
    </section>
  )
}
