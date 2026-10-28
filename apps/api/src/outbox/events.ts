/** The events the outbox carries (PRD Notification Catalog, plus room cleanup). */
export type OutboxEvent =
  | 'lesson.scheduled'
  | 'lesson.reminder'
  | 'lesson.started'
  | 'lesson.cancelled'
  | 'lesson.rescheduled'
  | 'registration.completed'
  | 'sessions.revoked'
  | 'meeting.close'

export type OutboxEntry = {
  event: OutboxEvent
  payload: Record<string, unknown>
  /** One key per domain transition: enqueueing it twice stores one row. */
  idempotencyKey: string
  /** Defaults to now; reminders are enqueued for the future. */
  availableAt?: Date
}

export type ReminderLead = '24h' | '15m'

export type LessonPayload = {
  lessonId: string
  groupId: string
  /** ISO instant of the lesson (the new one after a reschedule). */
  scheduledAt: string
  previousScheduledAt?: string
  lead?: ReminderLead
}

const URGENT: ReadonlySet<OutboxEvent> = new Set([
  'lesson.started',
  'sessions.revoked',
  'meeting.close',
])

/**
 * Urgent sends ignore quiet hours. The 15-minute reminder is urgent because
 * it is only useful right before the lesson.
 */
export function isUrgent(event: OutboxEvent, payload: { lead?: string } = {}) {
  return (
    URGENT.has(event) || (event === 'lesson.reminder' && payload.lead === '15m')
  )
}

/** Where an event is delivered. `meeting.close` is a task, not a message. */
export function channelsFor(event: OutboxEvent): {
  web: boolean
  telegram: boolean
} {
  switch (event) {
    case 'registration.completed':
      return { web: false, telegram: true }
    // The bot already confirms a revoke-all in its reply; the web inbox keeps
    // the record for the next login, so no second DM is sent.
    case 'sessions.revoked':
      return { web: true, telegram: false }
    case 'meeting.close':
      return { web: false, telegram: false }
    default:
      return { web: true, telegram: true }
  }
}
