import { Link } from '@tanstack/react-router'
import { statusKey } from '../lib/assignments'
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
  if (assignments.length === 0)
    return <p className="hint">{copy.myTestsEmpty}</p>
  return (
    <ul className="rows classroom-list">
      {assignments.map((a) => (
        <li key={a.attemptId} className="row classroom-row">
          <Link
            to="/app/attempts/$attemptId"
            params={{ attemptId: a.attemptId }}
            search={keepAppSearch(previewRole)}
          >
            <strong>{a.title}</strong>
            <span>
              {a.groupName} · {copy.assignmentDeadline}{' '}
              {formatLessonTime(a.deadline, locale)}
            </span>
            <span>
              <span className="tag">{copy[statusKey[a.status]]}</span>
              {a.status === 'graded' && a.score !== null ? (
                <>
                  {' '}
                  {copy.attemptScore}: <span className="num">{a.score}</span>
                </>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
