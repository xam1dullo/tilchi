import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmLogin, miniAppLogin, startLogin } from './api'

function answer(status: number, body: string) {
  return vi.fn(async () => new Response(body, { status }))
}

function stubFetch(fetch: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('startLogin', () => {
  it('posts to /auth/start with cookies and no body, and returns the JSON', async () => {
    const body = { handoffId: 'h-1', deepLink: 'https://t.me/b?start=h1' }
    const fetch = stubFetch(answer(201, JSON.stringify(body)))
    await expect(startLogin()).resolves.toEqual({ ok: true, body })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/auth/start', {
      method: 'POST',
      credentials: 'include',
      signal: undefined,
    })
  })

  it('reports the status of a refused request', async () => {
    stubFetch(answer(429, '{"error":"rate_limited","scope":"ip"}'))
    await expect(startLogin()).resolves.toEqual({ ok: false, status: 429 })
  })
})

describe('confirmLogin', () => {
  it('posts the handoff id as JSON with cookies and the abort signal', async () => {
    const fetch = stubFetch(answer(201, '{"ok":true}'))
    const controller = new AbortController()
    await expect(confirmLogin('h-1', controller.signal)).resolves.toEqual({
      ok: true,
      body: { ok: true },
    })
    expect(fetch).toHaveBeenCalledWith('/auth/confirm', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{"handoffId":"h-1"}',
      signal: controller.signal,
    })
  })

  it('keeps the status for 409, 410 and 403 answers', async () => {
    for (const status of [409, 410, 403]) {
      stubFetch(answer(status, '{"status":"waiting"}'))
      await expect(
        confirmLogin('h-1', new AbortController().signal),
      ).resolves.toEqual({ ok: false, status })
    }
  })
})

describe('miniAppLogin', () => {
  it('posts the initData as JSON with cookies', async () => {
    const fetch = stubFetch(answer(201, '{"ok":true}'))
    await expect(miniAppLogin('query_id=1&hash=2')).resolves.toEqual({
      ok: true,
      body: { ok: true },
    })
    expect(fetch).toHaveBeenCalledWith('/auth/miniapp', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{"initData":"query_id=1&hash=2"}',
      signal: undefined,
    })
  })

  it('reports 401 for initData the API refuses', async () => {
    stubFetch(answer(401, '{"error":"invalid_init_data"}'))
    await expect(miniAppLogin('x=1')).resolves.toEqual({
      ok: false,
      status: 401,
    })
  })
})

describe('every auth call', () => {
  it('keeps the status when the error body is not JSON', async () => {
    stubFetch(answer(502, '<html>Bad gateway</html>'))
    await expect(startLogin()).resolves.toEqual({ ok: false, status: 502 })
  })

  it('returns a null body when a 2xx answer is not JSON', async () => {
    stubFetch(answer(201, 'created'))
    await expect(startLogin()).resolves.toEqual({ ok: true, body: null })
  })

  it('never throws: a missing answer is status null', async () => {
    stubFetch(
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(startLogin()).resolves.toEqual({ ok: false, status: null })
    await expect(
      confirmLogin('h-1', new AbortController().signal),
    ).resolves.toEqual({ ok: false, status: null })
    await expect(miniAppLogin('x=1')).resolves.toEqual({
      ok: false,
      status: null,
    })
  })

  it('treats an aborted request as no answer', async () => {
    const controller = new AbortController()
    stubFetch(
      vi.fn(
        (_path: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'))
            })
          }),
      ),
    )
    const pending = confirmLogin('h-1', controller.signal)
    controller.abort()
    await expect(pending).resolves.toEqual({ ok: false, status: null })
  })
})
