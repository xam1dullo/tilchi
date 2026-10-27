import { createIsomorphicFn } from '@tanstack/react-start'
import { apiFailure } from './http-failure'

// Only constant API paths go in here. On the server the request is made as the
// browser's user by forwarding its cookie to the API inside the compose network.
export const apiGet = createIsomorphicFn()
  .server(async (path: string): Promise<unknown> => {
    const base = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001'
    const { getRequestHeader } = await import('@tanstack/react-start/server')
    const response = await fetch(`${base}${path}`, {
      headers: { cookie: getRequestHeader('cookie') ?? '' },
    })
    if (!response.ok) throw apiFailure(response.status)
    return response.json()
  })
  .client(async (path: string): Promise<unknown> => {
    const response = await fetch(path, { credentials: 'include' })
    if (!response.ok) throw apiFailure(response.status)
    return response.json()
  })
