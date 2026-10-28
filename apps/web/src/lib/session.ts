import { createIsomorphicFn } from '@tanstack/react-start'
import type { AppRole } from './nav'
import {
  parsePreviewRole,
  previewRuntimeAllowed,
  previewUser,
  runtimeEnv,
} from './preview'

export type SessionUser = {
  userId: string
  role: AppRole
  name?: string | null
}

export const loadSession = createIsomorphicFn()
  .server(async (): Promise<SessionUser | null> => {
    const base = runtimeEnv('API_INTERNAL_URL') ?? 'http://127.0.0.1:3001'
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

export const loadPreviewUser = createIsomorphicFn()
  .server(
    async (
      override: AppRole | null | undefined,
    ): Promise<SessionUser | null> => {
      if (!previewRuntimeAllowed(runtimeEnv('NODE_ENV'))) return null
      const role =
        override ?? parsePreviewRole(runtimeEnv('TILCHI_PREVIEW_ROLE'))
      return role ? previewUser(role) : null
    },
  )
  .client(
    async (
      override: AppRole | null | undefined,
    ): Promise<SessionUser | null> => {
      try {
        const response = await fetch('/api/demo/preview', {
          credentials: 'include',
        })
        if (!response.ok) return null
        const body = (await response.json()) as {
          enabled?: boolean
          role?: string | null
        }
        if (!body.enabled) return null
        const role = override ?? parsePreviewRole(body.role)
        return role ? previewUser(role) : null
      } catch {
        return null
      }
    },
  )

export async function resolveAppSession(
  searchPreview?: AppRole | null,
): Promise<SessionUser | null> {
  const signedIn = await loadSession()
  if (signedIn) return signedIn
  return loadPreviewUser(searchPreview)
}

/**
 * After a login: check the cookie really gave a session, then reload the route
 * so /app resolves it. false: still signed out, nothing was reloaded.
 */
export async function enterApp(
  router: { invalidate: () => Promise<unknown> },
  load: () => Promise<SessionUser | null> = loadSession,
) {
  if (!(await load())) return false
  await router.invalidate()
  return true
}
