import type { OutboxEntry, ReminderLead } from './events'

const LEADS: ReadonlyArray<{ lead: ReminderLead; ms: number }> = [
  { lead: '24h', ms: 24 * 60 * 60 * 1000 },
  { lead: '15m', ms: 15 * 60 * 1000 },
]

/**
 * T-24 h and T-15 min reminders for a lesson. A lead already in the past is
 * skipped: a lesson booked for tomorrow morning at night gets no 24 h reminder.
 * `revision` names the schedule or reschedule that produced them, so a lesson
 * moved away and back gets fresh reminders instead of colliding with old keys.
 */
export function reminderEntries(
  lesson: { id: string; groupId: string; scheduledAt: Date },
  revision: string,
  now: Date,
): OutboxEntry[] {
  return LEADS.flatMap(({ lead, ms }) => {
    const availableAt = new Date(lesson.scheduledAt.getTime() - ms)
    if (availableAt.getTime() <= now.getTime()) return []
    return [
      {
        event: 'lesson.reminder' as const,
        payload: {
          lessonId: lesson.id,
          groupId: lesson.groupId,
          scheduledAt: lesson.scheduledAt.toISOString(),
          lead,
        },
        idempotencyKey: `lesson.reminder.${lead}:${lesson.id}:${revision}`,
        availableAt,
      },
    ]
  })
}
