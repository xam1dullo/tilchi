import { ApiError } from './api'
import { tashkentInputToIso } from './classroom'
import type { Copy } from './i18n'

export type AttemptStatus = 'assigned' | 'submitted' | 'graded' | 'missed'

export type AttemptSummary = {
  id: string
  userId: string
  name: string | null
  status: AttemptStatus
  score: number | null
  submittedAt: string | null
}

/** One row of `GET /api/groups/:groupId/assignments`. */
export type AssignmentRecord = {
  id: string
  testId: string
  title: string
  deadline: string
  attempts: AttemptSummary[]
}

type ErrorKey = keyof Copy

export const ATTEMPT_STATUSES: readonly AttemptStatus[] = [
  'assigned',
  'submitted',
  'graded',
  'missed',
]

export const statusKey: Record<AttemptStatus, ErrorKey> = {
  assigned: 'attemptAssigned',
  submitted: 'attemptSubmitted',
  graded: 'attemptGraded',
  missed: 'attemptMissed',
}

// Mirrors apps/api/src/assessment/inputs.ts, for UX only; the server decides.
const MAX_DEADLINE_MS = 366 * 24 * 3_600_000

/** The request body, or the copy key of what the user must fix first. */
export function toAssignBody(
  testId: string,
  localDeadline: string,
  now: Date,
):
  | { ok: true; body: { testId: string; deadline: string } }
  | { ok: false; error: ErrorKey } {
  if (!testId) return { ok: false, error: 'assignTestRequired' }
  const deadline = tashkentInputToIso(localDeadline)
  if (!deadline) return { ok: false, error: 'assignDeadlineInvalid' }
  const at = new Date(deadline).getTime()
  if (at <= now.getTime()) return { ok: false, error: 'assignDeadlinePast' }
  if (at > now.getTime() + MAX_DEADLINE_MS)
    return { ok: false, error: 'assignDeadlineInvalid' }
  return { ok: true, body: { testId, deadline } }
}

export function statusCounts(attempts: Pick<AttemptSummary, 'status'>[]) {
  const counts = { assigned: 0, submitted: 0, graded: 0, missed: 0 }
  for (const a of attempts) counts[a.status] += 1
  return counts
}

const ERRORS: Record<string, ErrorKey> = {
  invalid_assignment: 'assignInvalid',
  invalid_test_id: 'assignTestRequired',
  invalid_deadline: 'assignDeadlineInvalid',
  not_found: 'assignNotFound',
}

/** Copy key for a failed assign; a 403 is "not allowed", unknown codes generic. */
export function assignError(error: unknown): ErrorKey {
  if (error instanceof ApiError && error.status === 403)
    return 'assignForbidden'
  return error instanceof Error && Object.hasOwn(ERRORS, error.message)
    ? ERRORS[error.message]
    : 'courseUnavailable'
}
