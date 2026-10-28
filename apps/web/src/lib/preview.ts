import type { AppRole } from './nav'
import type { SessionUser } from './session'

export function parsePreviewRole(value: unknown): AppRole | null {
  if (value === 'learner' || value === 'teacher' || value === 'admin')
    return value
  return null
}

export function runtimeEnv(name: string): string | undefined {
  return process.env[name]
}

export function previewUser(role: AppRole): SessionUser {
  if (role === 'teacher')
    return { userId: 'preview-teacher', role, name: 'Demo teacher' }
  if (role === 'admin')
    return { userId: 'preview-admin', role, name: 'Demo admin' }
  return { userId: 'preview-learner', role, name: 'Demo learner' }
}

export function isPreviewUser(user: SessionUser | null | undefined) {
  return user?.userId.startsWith('preview-') ?? false
}

export function keepAppSearch(preview: AppRole | null | undefined) {
  return { handoff: undefined as undefined, preview: preview ?? undefined }
}
