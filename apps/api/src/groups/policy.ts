import type { Role } from '../auth/policy'
import { isRecord, parseUuid } from '../http/params'
import { type Result, fail, ok } from '../http/result'

export const GROUP_CAPACITY_MAX = 12
export const GROUP_NAME_MAX = 100

export type Actor = { userId: string; role: Role }

export type GroupInput = {
  name: string
  capacity: number
  teacherId: string | null
}

// Group create: admin or teacher. Membership and deletion: admin only.
export const canCreateGroup = (role: Role) =>
  role === 'admin' || role === 'teacher'

export const canManageGroups = (role: Role) => role === 'admin'

// Admin, or the teacher the group names. The role is checked as well as the
// id: a teacher who was demoted keeps the row but not the right to run it.
export const teachesGroup = (actor: Actor, teacherId: string) =>
  actor.role === 'admin' ||
  (actor.role === 'teacher' && actor.userId === teacherId)

const CONTROL_CHARACTERS = /\p{Cc}/u

function parseName(value: unknown): Result<string> {
  if (typeof value !== 'string') return fail(400, 'bad_name')
  const name = value.trim()
  if (!name || name.length > GROUP_NAME_MAX || CONTROL_CHARACTERS.test(name)) {
    return fail(400, 'bad_name')
  }
  return ok(name)
}

function parseCapacity(value: unknown): Result<number> {
  if (value === undefined) return ok(GROUP_CAPACITY_MAX)
  const valid =
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= GROUP_CAPACITY_MAX
  return valid ? ok(value) : fail(400, 'bad_capacity')
}

function parseTeacher(value: unknown): Result<string | null> {
  if (value === undefined) return ok(null)
  return parseUuid(value, 'bad_teacher')
}

export function parseGroupInput(body: unknown): Result<GroupInput> {
  if (!isRecord(body)) return fail(400, 'bad_request')
  const name = parseName(body.name)
  if (!name.ok) return name
  const capacity = parseCapacity(body.capacity)
  if (!capacity.ok) return capacity
  const teacherId = parseTeacher(body.teacherId)
  if (!teacherId.ok) return teacherId
  return ok({
    name: name.value,
    capacity: capacity.value,
    teacherId: teacherId.value,
  })
}

// A teacher can only create a group they teach; an admin must say who teaches.
export function chooseTeacher(
  actor: Actor,
  requested: string | null,
): Result<string> {
  if (actor.role === 'admin') {
    return requested ? ok(requested) : fail(400, 'bad_teacher')
  }
  if (actor.role !== 'teacher') return fail(403, 'forbidden')
  if (requested && requested !== actor.userId) return fail(403, 'forbidden')
  return ok(actor.userId)
}

export function parseMemberInput(body: unknown): Result<string> {
  if (!isRecord(body)) return fail(400, 'bad_user')
  return parseUuid(body.userId, 'bad_user')
}
