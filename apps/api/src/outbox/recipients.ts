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

const RULES: Partial<Record<OutboxEvent, (scope: Scope) => Member[]>> = {
  'lesson.scheduled': learners,
  'lesson.cancelled': learners,
  'lesson.rescheduled': learners,
  'lesson.reminder': learnersAndTeacher,
  'lesson.started': notJoined,
  'sessions.revoked': subject,
}

/**
 * Who gets the message, by event. The admin chat is not a user and is handled
 * apart, so `registration.completed` and tasks have no user recipients.
 */
export const recipientsFor = (event: OutboxEvent, scope: Scope): Member[] =>
  RULES[event]?.(scope) ?? []
