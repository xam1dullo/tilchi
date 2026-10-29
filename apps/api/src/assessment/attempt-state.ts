export type AttemptStatus = 'assigned' | 'submitted' | 'graded' | 'missed'
export type AttemptEvent = 'submit' | 'grade' | 'sweep'

export type Refusal =
  | 'already_submitted'
  | 'deadline_passed'
  | 'not_submitted'
  | 'already_graded'

/**
 * `status` is what to store next (it differs from the current one only when
 * the event moved the attempt). `refused` is set when the event itself must be
 * rejected; a refused submit after the deadline still records `missed`.
 */
export type Transition = { status: AttemptStatus; refused?: Refusal }

/**
 * The attempt state machine (PRD J5 AC3), pure: `assigned -> submitted ->
 * graded`, or `assigned -> missed` once the deadline has passed with no
 * submission. The deadline itself is still on time; one instant later is late.
 */
export function transition(
  status: AttemptStatus,
  event: AttemptEvent,
  at: { now: Date; deadline: Date },
): Transition {
  const late = at.now.getTime() > at.deadline.getTime()
  if (event === 'submit') return submit(status, late)
  if (event === 'grade') return grade(status)
  return { status: status === 'assigned' && late ? 'missed' : status }
}

function submit(status: AttemptStatus, late: boolean): Transition {
  if (status === 'assigned') {
    return late
      ? { status: 'missed', refused: 'deadline_passed' }
      : { status: 'submitted' }
  }
  return status === 'missed'
    ? { status, refused: 'deadline_passed' }
    : { status, refused: 'already_submitted' }
}

function grade(status: AttemptStatus): Transition {
  if (status === 'submitted') return { status: 'graded' }
  return status === 'graded'
    ? { status, refused: 'already_graded' }
    : { status, refused: 'not_submitted' }
}

/** Learners may still answer or record audio only while the attempt is open. */
export function acceptsAnswers(
  status: AttemptStatus,
  at: { now: Date; deadline: Date },
) {
  return status === 'assigned' && at.now.getTime() <= at.deadline.getTime()
}

/** What a reader should see: an overdue open attempt is already missed. */
export function effectiveStatus(
  status: AttemptStatus,
  at: { now: Date; deadline: Date },
): AttemptStatus {
  return transition(status, 'sweep', at).status
}
