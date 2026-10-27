import { createIsomorphicFn } from '@tanstack/react-start'
import type { AppRole } from './nav'

export type SessionUser = {
  userId: string
  role: AppRole
  name?: string | null
}

function previewRole(): AppRole | null {
  const role = process.env.TILCHI_PREVIEW_ROLE
  if (role === 'learner' || role === 'teacher' || role === 'admin') return role
  return null
}

export const loadSession = createIsomorphicFn()
  .server(async (): Promise<SessionUser | null> => {
    if (process.env.NODE_ENV !== 'production') {
      const role = previewRole()
      if (role) return { userId: 'preview', role, name: 'Preview' }
    }
    const base = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001'
    try {
      const { getRequestHeader } = await import('@tanstack/react-start/server')
      const response = await fetch(`${base}/auth/session`, {
        headers: { cookie: getRequestHeader('cookie') ?? '' },
      })
      if (!response.ok) return null
      const body = (await response.json()) as { user: SessionUser | null }
      return body.user ?? null
    } catch {
      return null
    }
  })
  .client(async (): Promise<SessionUser | null> => {
    try {
      const response = await fetch('/auth/session', { credentials: 'include' })
      if (!response.ok) return null
      const body = (await response.json()) as { user: SessionUser | null }
      return body.user ?? null
    } catch {
      return null
    }
  })
