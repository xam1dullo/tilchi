import { createIsomorphicFn } from '@tanstack/react-start'
import { appRoles, type AppRole } from './nav'

export type SessionUser = {
  userId: string
  role: AppRole
  name?: string | null
}

// Local look at the signed-in screens without the API. Never in production.
export function previewSession(): SessionUser | null {
  if (process.env.NODE_ENV === 'production') return null
  const role = appRoles.find((item) => item === process.env.TILCHI_PREVIEW_ROLE)
  return role ? { userId: 'preview', role, name: 'Preview' } : null
}

export const loadSession = createIsomorphicFn()
  .server(async (): Promise<SessionUser | null> => {
    const preview = previewSession()
    if (preview) return preview
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
