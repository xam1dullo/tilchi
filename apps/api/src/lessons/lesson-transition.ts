import type { LessonStatus } from './lessons.repository'

export type LessonRow = {
  status: LessonStatus
  startedAt: Date | null
  endedAt: Date | null
}

export type LessonCommand =
  | { type: 'start' }
  | { type: 'end' }
  | { type: 'cancel' }
  | { type: 'reschedule'; scheduledAt: Date }

export type LessonPatch = {
  status?: LessonStatus
  startedAt?: Date
  endedAt?: Date
  cancelledAt?: Date
  scheduledAt?: Date
}

export type Transition =
  | { kind: 'next'; patch: LessonPatch }
  | { kind: 'same' }
  | { kind: 'refused' }

const SAME: Transition = { kind: 'same' }
const REFUSED: Transition = { kind: 'refused' }

/**
 * The one place that says which lesson status changes are legal:
 * scheduled -> live -> ended, scheduled -> cancelled, and rescheduling while
 * scheduled. Repeating a command that already holds is `same`; anything else
 * is `refused`, so a late End can never overwrite a Cancel.
 */
export function lessonTransition(
  lesson: LessonRow,
  command: LessonCommand,
  now: Date,
): Transition {
  switch (command.type) {
    case 'start':
      if (lesson.status === 'live') return SAME
      return lesson.status === 'scheduled'
        ? { kind: 'next', patch: { status: 'live', startedAt: now } }
        : REFUSED
    case 'end':
      if (lesson.status === 'ended') return SAME
      return lesson.status === 'live'
        ? { kind: 'next', patch: { status: 'ended', endedAt: now } }
        : REFUSED
    case 'cancel':
      if (lesson.status === 'cancelled') return SAME
      return lesson.status === 'scheduled'
        ? { kind: 'next', patch: { status: 'cancelled', cancelledAt: now } }
        : REFUSED
    case 'reschedule':
      return lesson.status === 'scheduled'
        ? { kind: 'next', patch: { scheduledAt: command.scheduledAt } }
        : REFUSED
  }
}
