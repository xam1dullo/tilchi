import { createIsomorphicFn } from '@tanstack/react-start'
import { apiFailure } from './http-failure'
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

// The API answers { user: null } when nobody is signed in. Any other answer
// means it could not say, and that must not look like a sign-out: the user's
// cookie is still good and a retry will find them again.
export async function readSession(
  response: Response,
): Promise<SessionUser | null> {
  if (!response.ok) throw apiFailure(response.status)
  const body = (await response.json()) as { user?: SessionUser | null }
  return body.user ?? null
}

export const loadSession = createIsomorphicFn()
  .server(async (): Promise<SessionUser | null> => {
    const preview = previewSession()
    if (preview) return preview
    const base = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001'
    const { getRequestHeader } = await import('@tanstack/react-start/server')
    return readSession(
      await fetch(`${base}/auth/session`, {
        headers: { cookie: getRequestHeader('cookie') ?? '' },
      }),
    )
  })
  .client(
    async (): Promise<SessionUser | null> =>
      readSession(await fetch('/auth/session', { credentials: 'include' })),
  )
