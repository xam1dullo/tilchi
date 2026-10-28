import type { AppRole } from './nav'

export type GroupRecord = {
  id: string
  name: string
  capacity: number
  memberIds: string[]
}

export type LessonStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

export type LessonRecord = {
  id: string
  groupId: string
  scheduledAt: string
  status: LessonStatus
  meetingId: string | null
}

export function groupsView(input: { role: AppRole; groups: GroupRecord[] }) {
  return {
    empty: input.groups.length === 0,
    canCreate: input.role === 'teacher' || input.role === 'admin',
    groups: input.groups,
  }
}

export function lessonActions(input: { role: AppRole; status: LessonStatus }) {
  const manages = input.role === 'teacher' || input.role === 'admin'
  return {
    canSchedule: manages,
    canStart: manages && input.status === 'scheduled',
    canEnd: manages && input.status === 'live',
    canJoin: input.status === 'live',
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
