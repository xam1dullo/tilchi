import type { Role } from '../auth/policy'

export const PREVIEW_HEADER = 'x-tilchi-preview-role'

export const DEMO_TEACHER = {
  userId: '0199aaa0-0000-7000-8000-000000000001',
  role: 'teacher' as const satisfies Role,
  name: 'Demo teacher',
}

export const DEMO_LEARNER = {
  userId: '0199aaa0-0000-7000-8000-000000000002',
  role: 'learner' as const satisfies Role,
  name: 'Demo learner',
}

export const DEMO_ADMIN = {
  userId: '0199aaa0-0000-7000-8000-000000000003',
  role: 'admin' as const satisfies Role,
  name: 'Demo admin',
}

export const DEMO_GROUP_ID = '0199aaa0-0000-7000-8000-000000000010'
export const DEMO_LESSON_ID = '0199aaa0-0000-7000-8000-000000000020'
export const DEMO_GROUP_NAME = 'A1 morning'
export const DEMO_SCHEDULED_AT = '2026-11-01T09:00:00+05:00'

export function parsePreviewRole(value: unknown): Role | null {
  if (value === 'learner' || value === 'teacher' || value === 'admin')
    return value
  return null
}

export function demoRuntimeAllowed(nodeEnv: string | undefined) {
  return nodeEnv === 'development' || nodeEnv === 'test'
}

export function demoEnabled(env: {
  nodeEnv: string | undefined
  demo: string | undefined
  previewRole: string | undefined
}) {
  if (!demoRuntimeAllowed(env.nodeEnv)) return false
  if (env.demo === '1') return true
  return parsePreviewRole(env.previewRole) !== null
}

export function processDemoEnv() {
  return {
    nodeEnv: process.env.NODE_ENV,
    demo: process.env.TILCHI_DEMO,
    previewRole: process.env.TILCHI_PREVIEW_ROLE,
  }
}

export function demoActor(role: Role) {
  if (role === 'teacher') return DEMO_TEACHER
  if (role === 'admin') return DEMO_ADMIN
  return DEMO_LEARNER
}
