/** Permissions the API computed for this caller; the web never re-derives them. */
export type GroupCan = {
  createLesson: boolean
  manageMembers: boolean
  seeMembers: boolean
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
