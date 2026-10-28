import { uuidv7 } from '../id'
import type { OutboxEntry } from './events'
import { reminderEntries } from './reminders'

type LessonRow = { id: string; groupId: string; scheduledAt: Date }

const payload = (lesson: LessonRow) => ({
  lessonId: lesson.id,
  groupId: lesson.groupId,
  scheduledAt: lesson.scheduledAt.toISOString(),
})

/** Outbox rows for each lesson transition; the repository queues them in its transaction. */
export function scheduledEntries(lesson: LessonRow, now: Date): OutboxEntry[] {
  return [
    {
      event: 'lesson.scheduled',
      payload: payload(lesson),
      idempotencyKey: `lesson.scheduled:${lesson.id}`,
    },
    ...reminderEntries(lesson, 'created', now),
  ]
}

export function startedEntries(lesson: LessonRow): OutboxEntry[] {
  return [
    {
      event: 'lesson.started',
      payload: payload(lesson),
      idempotencyKey: `lesson.started:${lesson.id}`,
    },
  ]
}

/** A lesson is cancelled once (cancelling again is a no-op), so the key is the lesson. */
export function cancelledEntries(lesson: LessonRow): OutboxEntry[] {
  return [
    {
      event: 'lesson.cancelled',
      payload: payload(lesson),
      idempotencyKey: `lesson.cancelled:${lesson.id}`,
    },
  ]
}

/** A lesson can move many times, so each move gets its own revision. */
export function rescheduledEntries(
  lesson: LessonRow,
  previous: Date,
  now: Date,
): OutboxEntry[] {
  const revision = uuidv7()
  return [
    {
      event: 'lesson.rescheduled',
      payload: {
        ...payload(lesson),
        previousScheduledAt: previous.toISOString(),
      },
      idempotencyKey: `lesson.rescheduled:${lesson.id}:${revision}`,
    },
    ...reminderEntries(lesson, revision, now),
  ]
}

export function endEntries(lessonId: string, room: string): OutboxEntry[] {
  return [
    {
      event: 'meeting.close',
      payload: { lessonId, room },
      idempotencyKey: `meeting.close:${lessonId}`,
    },
  ]
}
