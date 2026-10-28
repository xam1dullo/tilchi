import { createIsomorphicFn } from '@tanstack/react-start'
import type { AppRole } from './nav'

export const PREVIEW_HEADER = 'X-Tilchi-Preview-Role'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(
      typeof body === 'object' &&
        body &&
        'error' in body &&
        typeof body.error === 'string'
        ? body.error
        : `api_${status}`,
    )
    this.status = status
    this.body = body
  }
}

const requestCookie = createIsomorphicFn()
  .server(async (): Promise<string> => {
    const { getRequestHeader } = await import('@tanstack/react-start/server')
    return getRequestHeader('cookie') ?? ''
  })
  .client((): string => '')

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { previewRole?: AppRole | null } = {},
): Promise<T> {
  const { previewRole, headers, ...rest } = init
  const base =
    typeof window === 'undefined'
      ? (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001')
      : ''
  const next = new Headers(headers)
  if (previewRole) next.set(PREVIEW_HEADER, previewRole)
  if (!next.has('content-type') && rest.body) {
    next.set('content-type', 'application/json')
  }
  const cookie = await requestCookie()
  if (cookie) next.set('cookie', cookie)
  const response = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...rest,
    headers: next,
  })
  const text = await response.text()
  const body = text ? (JSON.parse(text) as T) : (null as T)
  if (!response.ok) throw new ApiError(response.status, body)
  return body
}
