import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { apiFetch } from '../lib/api'
import {
  ATTEMPT_STATUSES,
  type AssignmentRecord,
  assignError,
  statusCounts,
  statusKey,
  toAssignBody,
} from '../lib/assignments'
import { formatLessonTime } from '../lib/classroom'
import { displayName } from '../lib/enrol'
import type { Copy } from '../lib/i18n'
import type { AppRole } from '../lib/nav'
import { keepAppSearch } from '../lib/preview'
import type { TestSummary } from '../lib/question-form'

export function AssignForm({
  groupId,
  previewRole,
  tests,
  copy,
}: {
  groupId: string
  previewRole: AppRole | null
  tests: TestSummary[]
  copy: Copy
}) {
  const router = useRouter()
  const [testId, setTestId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<keyof Copy | null>(null)
  const [done, setDone] = useState(false)
  const [attempt, setAttempt] = useState(0)

  async function submit() {
    if (busy) return
    setAttempt((n) => n + 1)
    setDone(false)
    const input = toAssignBody(testId, deadline, new Date())
    if (!input.ok) return setError(input.error)
    setError(null)
    setBusy(true)
    try {
      await apiFetch(`/api/groups/${encodeURIComponent(groupId)}/assignments`, {
        method: 'POST',
        previewRole,
        body: JSON.stringify(input.body),
      })
      await router.invalidate()
      setTestId('')
      setDeadline('')
      setDone(true)
    } catch (failure) {
      setError(assignError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="assign" aria-labelledby="assign-title">
      <h3 id="assign-title">{copy.assignTitle}</h3>
      {tests.length === 0 ? (
        <p className="hint">
          {copy.assignNoTests}{' '}
          <Link to="/app/tests" search={keepAppSearch(previewRole)}>
            {copy.tests}
          </Link>
        </p>
      ) : (
        <form
          className="classroom-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <fieldset className="question-lock" disabled={busy}>
            <label className="assign-field">
              {copy.assignTest}
              <select
                value={testId}
                required
                onChange={(event) => setTestId(event.target.value)}
              >
                <option value="">{copy.assignPickTest}</option>
                {tests.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="assign-field">
              {copy.assignDeadline}
              <input
                type="datetime-local"
                required
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </label>
            <button className="btn btn-primary" type="submit">
              {busy ? copy.courseSaving : copy.assignSubmit}
            </button>
          </fieldset>
          {error ? (
            <p
              key={`error-${attempt}`}
              className="notice"
              data-tone="error"
              role="alert"
            >
              {copy[error]}
            </p>
          ) : null}
          {done ? (
            <p
              key={`done-${attempt}`}
              className="notice"
              data-tone="done"
              role="status"
            >
              {copy.assignDone}
            </p>
          ) : null}
        </form>
      )}
    </section>
  )
}

export function AssignmentsList({
  assignments,
  copy,
  locale,
}: {
  assignments: AssignmentRecord[]
  copy: Copy
  locale: string
}) {
  return (
    <section className="assignments" aria-labelledby="assignments-title">
      <h3 id="assignments-title">{copy.assignments}</h3>
      {assignments.length === 0 ? (
        <p className="hint">{copy.assignmentsEmpty}</p>
      ) : (
        <ul className="rows classroom-list">
          {assignments.map((assignment) => {
            const counts = statusCounts(assignment.attempts)
            return (
              <li key={assignment.id} className="row assignment-row">
                <p className="assignment-head">
                  <strong>{assignment.title}</strong>{' '}
                  <span className="hint">
                    {copy.assignmentDeadline}{' '}
                    {formatLessonTime(assignment.deadline, locale)}
                  </span>
                </p>
                <p className="assignment-counts">
                  {ATTEMPT_STATUSES.map((status) => (
                    <span key={status} className="tag">
                      {copy[statusKey[status]]}:{' '}
                      <span className="num">{counts[status]}</span>
                    </span>
                  ))}
                </p>
                {assignment.attempts.length === 0 ? (
                  <p className="hint">{copy.attemptNoLearners}</p>
                ) : (
                  <details className="assignment-details">
                    <summary>
                      {copy.assignmentLearners} ({assignment.attempts.length})
                    </summary>
                    <table className="attempt-table">
                      <thead>
                        <tr>
                          <th scope="col">{copy.attemptLearner}</th>
                          <th scope="col">{copy.questionFilter}</th>
                          <th scope="col">{copy.attemptScore}</th>
                          <th scope="col">{copy.attemptSubmittedAt}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignment.attempts.map((a) => (
                          <tr key={a.id}>
                            <th scope="row">
                              {displayName({ id: a.userId, name: a.name })}
                            </th>
                            <td>
                              <span className="tag">
                                {copy[statusKey[a.status]]}
                              </span>
                            </td>
                            <td className="num">{a.score ?? '—'}</td>
                            <td>
                              {a.submittedAt
                                ? formatLessonTime(a.submittedAt, locale)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
