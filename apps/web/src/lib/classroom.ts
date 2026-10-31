import { uzShortMonths } from './i18n/uz'

/** Permissions the API computed for this caller; the web never re-derives them. */
export type GroupCan = {
  createLesson: boolean
  manageMembers: boolean
  seeMembers: boolean
  assignTest: boolean
  viewAssignments: boolean
  gradeAttempts: boolean
}

export type GroupRecord = {
  id: string
  name: string
  kind: 'adult' | 'kids'
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

export const LESSON_START_GRACE_MS = 3 * 60 * 60 * 1000

export function nextGroupLesson<
  T extends Pick<LessonRecord, 'status' | 'scheduledAt'>,
>(lessons: readonly T[], now: number | null): T | undefined {
  return (
    lessons.find((lesson) => lesson.status === 'live') ??
    lessons.reduce<T | undefined>((next, lesson) => {
      const time = Date.parse(lesson.scheduledAt)
      return now !== null &&
        lesson.status === 'scheduled' &&
        time >= now - LESSON_START_GRACE_MS &&
        (!next || time < Date.parse(next.scheduledAt))
        ? lesson
        : next
    }, undefined)
  )
}

export function formatLessonTime(iso: string, locale: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  if (locale === 'uz' || locale.startsWith('uz-')) {
    // Numeric parts keep timezone conversion in Intl without relying on Uzbek
    // month data (some runtimes fall back to labels such as "M11").
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Tashkent',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(date)
        .map(({ type, value }) => [type, value]),
    )
    return `${Number(parts.day)}-${uzShortMonths[Number(parts.month) - 1]}, ${parts.year}, ${parts.hour}:${parts.minute}`
  }
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

export type Teacher = { id: string; name: string | null }

export type CreateGroupForm = {
  name: string
  teacherId: string
  /** Admins must pick a teacher; teachers create under their own name. */
  assignTeacher: boolean
  teachers: Teacher[]
  busy: boolean
}

/** What the create form shows and allows; the component only paints this. */
export function createGroupView(form: CreateGroupForm) {
  const noTeachers = form.assignTeacher && form.teachers.length === 0
  const picked =
    !form.assignTeacher || form.teachers.some((t) => t.id === form.teacherId)
  return {
    showTeacher: form.assignTeacher && !noTeachers,
    noTeachers,
    canSubmit: !form.busy && !noTeachers && picked && form.name.trim() !== '',
  }
}

/** The request body: only an admin sends a teacherId. */
export function createGroupBody(form: CreateGroupForm) {
  return form.assignTeacher
    ? { name: form.name, teacherId: form.teacherId }
    : { name: form.name }
}

/** Copy key for a failed create; anything but teacher_required is generic. */
export function createGroupError(error: unknown) {
  return error instanceof Error && error.message === 'teacher_required'
    ? ('teacherRequired' as const)
    : ('createGroupFailed' as const)
}
