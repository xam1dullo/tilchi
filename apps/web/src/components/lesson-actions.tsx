import { Link } from '@tanstack/react-router'
import type { LessonRecord } from '../lib/classroom'
import type { keepAppSearch } from '../lib/preview'

export type LessonActionsCopy = {
  start: string
  end: string
  join: string
  confirmEnd: string
  confirmEndHint: string
}

// Join leads; End is a separate outline-danger button that only ends the
// lesson on a second, confirming press (a double tap must not end it for all).
export function LessonActions({
  lesson,
  primary,
  busy,
  confirming,
  search,
  copy,
  onStart,
  onArmEnd,
  onConfirmEnd,
  onCancelEnd,
}: {
  lesson: LessonRecord
  primary: boolean
  busy: boolean
  confirming: boolean
  search: ReturnType<typeof keepAppSearch>
  copy: LessonActionsCopy
  onStart: () => void
  onArmEnd: () => void
  onConfirmEnd: () => void
  onCancelEnd: () => void
}) {
  const describedBy = primary ? `primary-lesson-time-${lesson.id}` : undefined
  const hintId = `lesson-end-hint-${primary ? 'primary-' : ''}${lesson.id}`
  return (
    <div className="lesson-actions">
      {lesson.can.join ? (
        <Link
          className="btn btn-primary"
          aria-describedby={describedBy}
          to="/app/meet/$lessonId"
          params={{ lessonId: lesson.id }}
          search={search}
        >
          {copy.join}
        </Link>
      ) : null}
      {lesson.can.start ? (
        <button
          className={primary ? 'btn btn-primary' : 'btn btn-outline'}
          type="button"
          disabled={busy}
          aria-describedby={describedBy}
          onClick={onStart}
        >
          {copy.start}
        </button>
      ) : null}
      {lesson.can.end ? (
        <>
          <button
            className="btn btn-outline lesson-end"
            type="button"
            disabled={busy}
            data-confirming={confirming || undefined}
            aria-describedby={
              confirming
                ? [describedBy, hintId].filter(Boolean).join(' ')
                : describedBy
            }
            onClick={confirming ? onConfirmEnd : onArmEnd}
            onKeyDown={(event) => {
              if (confirming && event.key === 'Escape') onCancelEnd()
            }}
            onBlur={confirming ? onCancelEnd : undefined}
          >
            {confirming ? copy.confirmEnd : copy.end}
          </button>
          <span id={hintId} className="sr-only" aria-live="polite">
            {confirming ? copy.confirmEndHint : ''}
          </span>
        </>
      ) : null}
    </div>
  )
}
