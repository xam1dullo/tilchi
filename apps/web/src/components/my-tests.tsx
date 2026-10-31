import { Link } from '@tanstack/react-router'
import { CabinetStats, CabinetIcon } from './cabinet-stats'
import { ATTEMPT_STATUSES, statusCounts, statusKey } from '../lib/assignments'
import type { MyAssignment } from '../lib/attempt'
import { formatLessonTime } from '../lib/classroom'
import type { Copy } from '../lib/i18n'
import type { AppRole } from '../lib/nav'
import { keepAppSearch } from '../lib/preview'

export function MyTestsList({
  assignments,
  copy,
  locale,
  previewRole,
}: {
  assignments: MyAssignment[]
  copy: Copy
  locale: string
  previewRole: AppRole | null
}) {
  const counts = statusCounts(assignments)
  const hints = {
    assigned: copy.cabinetAssignedHint,
    submitted: copy.cabinetSubmittedHint,
    graded: copy.cabinetGradedHint,
    missed: copy.cabinetMissedHint,
  }
  return (
    <div className="assignments-page">
      <CabinetStats
        items={ATTEMPT_STATUSES.map((status) => ({
          label: copy[statusKey[status]],
          value: counts[status],
          hint: hints[status],
        }))}
      />
      {assignments.length === 0 ? (
        <p className="hint">{copy.myTestsEmpty}</p>
      ) : (
        <ul className="rows classroom-list">
          {assignments.map((a) => (
            <li key={a.attemptId} className="row classroom-row">
              <Link
                to="/app/attempts/$attemptId"
                params={{ attemptId: a.attemptId }}
                search={keepAppSearch(previewRole)}
              >
                <CabinetIcon />
                <span className="cabinet-title">
                  <strong>{a.title}</strong>
                  <span className="cabinet-meta">
                    {a.groupName} · {copy.assignmentDeadline}{' '}
                    {formatLessonTime(a.deadline, locale)}
                  </span>
                </span>
                <span className="tag">{copy[statusKey[a.status]]}</span>
                <span className="cabinet-score">
                  {a.status === 'graded' && a.score !== null ? (
                    <>
                      {' '}
                      {copy.attemptScore}:{' '}
                      <span className="num">{a.score}</span>
                    </>
                  ) : (
                    <span aria-hidden="true">—</span>
                  )}
                </span>
                <span className="cabinet-action">
                  {copy.cabinetOpen} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
