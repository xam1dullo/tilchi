import type { AppRole } from './nav'

export type GroupRecord = {
  id: string
  name: string
  capacity: number
  learnerCount: number
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
