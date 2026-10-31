import { Link } from '@tanstack/react-router'
import type { LessonRecord } from '../lib/classroom'
import type { keepAppSearch } from '../lib/preview'

export type LessonActionsCopy = {
  start: string
  end: string
  join: string
  confirmEnd: string
  confirmEndHint: string
  failed: string
}

// Join leads; End is a separate outline-danger button. Arming and the
// double-tap guard live in lib/lesson-actions (createEndConfirm).
export function LessonActions({
  lesson,
  primary,
  busy,
  confirming,
  failed,
  search,
  copy,
  onStart,
  onEnd,
  onCancelEnd,
}: {
  lesson: LessonRecord
  primary: boolean
  busy: boolean
  confirming: boolean
  failed: boolean
  search: ReturnType<typeof keepAppSearch>
  copy: LessonActionsCopy
  onStart: () => void
  onEnd: (repeat: boolean) => void
  onCancelEnd: () => void
}) {
  const describedBy = primary ? `primary-lesson-time-${lesson.id}` : undefined
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
            aria-describedby={describedBy}
            onClick={() => onEnd(false)}
            onKeyDown={(event) => {
              if (confirming && event.key === 'Escape') onCancelEnd()
              // Enter clicks on every auto-repeat; handle it here so a held
              // key cannot confirm End once the guard has passed.
              if (event.key === 'Enter') {
                event.preventDefault()
                onEnd(event.repeat)
              }
            }}
            onBlur={confirming ? onCancelEnd : undefined}
          >
            {confirming ? copy.confirmEnd : copy.end}
          </button>
          <span className="sr-only" aria-live="polite">
            {confirming ? copy.confirmEndHint : ''}
          </span>
        </>
      ) : null}
      {failed ? (
        <p className="notice" data-tone="error" role="alert">
          {copy.failed}
        </p>
      ) : null}
    </div>
  )
}
