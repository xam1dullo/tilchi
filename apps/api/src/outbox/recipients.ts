import type { Role } from '../auth/policy'
import type { OutboxEvent } from './events'

export type Member = {
  userId: string
  telegramId: string | null
  role: Role
}

export type Scope = {
  teacherId: string | null
  members: Member[]
  /** Users who already joined the lesson's meeting. */
  joinedIds: string[]
  /** The user an event is about (all sessions revoked). */
  subject: Member | null
  /** The assignment's attempts, for the test events. */
  attempts?: { userId: string; status: string }[]
  /**
   * Set by the event, not looked up: a notice meant for one learner reaches
   * that learner or nobody, never the group (even if they were deleted).
   */
  onlyUserId?: string
}

const learners = (scope: Scope) =>
  scope.members.filter((m) => m.role === 'learner')

const learnersAndTeacher = (scope: Scope) => [
  ...learners(scope),
  ...scope.members.filter(
    (m) => m.role !== 'learner' && m.userId === scope.teacherId,
  ),
]

const notJoined = (scope: Scope) =>
  learners(scope).filter((m) => !scope.joinedIds.includes(m.userId))

const subject = (scope: Scope) => (scope.subject ? [scope.subject] : [])

const withAttempt =
  (open: boolean) =>
  (scope: Scope): Member[] => {
    const { attempts = [] } = scope
    const ids = attempts
      .filter((a) => !open || a.status === 'assigned')
      .map((a) => a.userId)
    return learners(scope).filter((m) => ids.includes(m.userId))
  }

const teacherOnly = (scope: Scope) =>
  scope.members.filter((m) => m.userId === scope.teacherId)

const RULES: Partial<Record<OutboxEvent, (scope: Scope) => Member[]>> = {
  'lesson.scheduled': learners,
  'lesson.cancelled': learners,
  'lesson.rescheduled': learners,
  'lesson.reminder': learnersAndTeacher,
  'lesson.started': notJoined,
  'sessions.revoked': subject,
  // A learner who joined after the test was set is told on their own.
  'test.assigned': (scope) =>
    withAttempt(false)(scope).filter(
      (m) => scope.onlyUserId === undefined || m.userId === scope.onlyUserId,
    ),
  'test.reminder': withAttempt(true),
  'test.submitted': teacherOnly,
  'test.graded': subject,
}

/**
 * Who gets the message, by event. The admin chat is not a user and is handled
 * apart, so `registration.completed` and tasks have no user recipients.
 */
export const recipientsFor = (event: OutboxEvent, scope: Scope): Member[] =>
  RULES[event]?.(scope) ?? []
