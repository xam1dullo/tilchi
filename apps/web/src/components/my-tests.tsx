import { useState } from 'react'
import { assignmentView, type AssignmentFilter } from '../lib/cabinet'
import { Link } from '@tanstack/react-router'
import { CabinetStats, CabinetIcon } from './cabinet-stats'
import { ATTEMPT_STATUSES, statusKey } from '../lib/assignments'
import type { MyAssignment } from '../lib/attempt'
import { formatLessonTime } from '../lib/classroom'
import type { Copy } from '../lib/i18n'
import type { AppRole } from '../lib/nav'
import { keepAppSearch } from '../lib/preview'

type MyTestsProps = {
  assignments: MyAssignment[]
  copy: Copy
  locale: string
  previewRole: AppRole | null
}

export function MyTestsList(props: MyTestsProps) {
  const [filter, setFilter] = useState<AssignmentFilter>('all')
  return <MyTestsView {...props} filter={filter} onFilter={setFilter} />
}

export function MyTestsView({
  assignments,
  copy,
  locale,
  previewRole,
  filter,
  onFilter,
}: MyTestsProps & {
  filter: AssignmentFilter
  onFilter: (filter: AssignmentFilter) => void
}) {
  const { counts, rows } = assignmentView(assignments, filter)
  const filters = ['all', ...ATTEMPT_STATUSES] as const
  const filterLabel = (value: AssignmentFilter) =>
    value === 'all' ? copy.assignmentFilterAll : copy[statusKey[value]]
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
      {assignments.length > 0 && (
        <fieldset
          className="assignment-filters"
          aria-label={copy.assignmentFilters}
        >
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              aria-label={`${filterLabel(value)}: ${counts[value]}`}
              onClick={() => onFilter(value)}
            >
              {filterLabel(value)}{' '}
              <span className="assignment-filter-count">{counts[value]}</span>
            </button>
          ))}
        </fieldset>
      )}
      {rows.length === 0 ? (
        <p className="hint">
          {assignments.length === 0
            ? copy.myTestsEmpty
            : copy.assignmentFilterEmpty}
        </p>
      ) : (
        <ul className="rows classroom-list">
          {rows.map((a) => (
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
