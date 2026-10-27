import { createIsomorphicFn } from '@tanstack/react-start'
import { apiGet } from './api'
import { previewSession } from './session'

export type GroupRow = {
  id: string
  name: string
  capacity: number
  memberCount: number
  teacherName: string | null
}

const bad = () => new Error('bad_groups')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readGroup(value: unknown): GroupRow {
  if (!isRecord(value)) throw bad()
  const { id, name, capacity, memberCount, teacher } = value
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof capacity !== 'number' ||
    typeof memberCount !== 'number' ||
    !isRecord(teacher)
  ) {
    throw bad()
  }
  const teacherName = teacher.name
  if (teacherName !== null && typeof teacherName !== 'string') throw bad()
  return { id, name, capacity, memberCount, teacherName }
}

// A body the page cannot read is an error, never an empty list: an empty list
// tells a learner they have no group.
export function readGroups(body: unknown): GroupRow[] {
  if (!isRecord(body) || !Array.isArray(body.groups)) throw bad()
  return body.groups.map(readGroup)
}

export const loadGroups = createIsomorphicFn()
  .server(async (): Promise<GroupRow[]> => {
    if (previewSession()) return []
    return readGroups(await apiGet('/api/groups'))
  })
  .client(
    async (): Promise<GroupRow[]> => readGroups(await apiGet('/api/groups')),
  )
