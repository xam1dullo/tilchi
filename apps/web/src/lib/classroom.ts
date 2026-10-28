/** Permissions the API computed for this caller; the web never re-derives them. */
export type GroupCan = { createLesson: boolean; manageMembers: boolean }

export type GroupRecord = {
  id: string
  name: string
  capacity: number
  learnerCount: number
  can: GroupCan
}

export type LessonStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

export type LessonCan = {
  start: boolean
  end: boolean
  cancel: boolean
  reschedule: boolean
  join: boolean
}

export type LessonRecord = {
  id: string
  groupId: string
  scheduledAt: string
  status: LessonStatus
  meetingId: string | null
  can: LessonCan
}

export function groupsView(input: {
  groups: GroupRecord[]
  can: { createGroup: boolean }
}) {
  return {
    empty: input.groups.length === 0,
    canCreate: input.can.createGroup,
    groups: input.groups,
  }
}

export function formatLessonTime(iso: string, locale: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Tashkent',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/**
 * Reads a `datetime-local` value as Asia/Tashkent wall time whatever the
 * device zone is. Tashkent is a fixed UTC+5 (no DST), so a literal offset
 * is exact. Null when the value is not a complete date and time.
 */
export function tashkentInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null
  const date = new Date(`${value}${value.length === 16 ? ':00' : ''}+05:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
