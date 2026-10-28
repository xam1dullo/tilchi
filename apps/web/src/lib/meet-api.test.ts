import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { fetchMeetToken, signalUrl, tokenFailure } from './meet-api'

describe('fetchMeetToken', () => {
  const issued = { token: 'jwt', room: 'lesson-1', expiresInSeconds: 60 }

  it('POSTs to the lesson token endpoint and forwards the preview role', async () => {
    const calls: { path: string; init: unknown }[] = []
    const token = await fetchMeetToken(
      'lesson-1',
      'teacher',
      async (path, init) => {
        calls.push({ path, init })
        return issued
      },
    )
    expect(token).toEqual(issued)
    expect(calls).toEqual([
      {
        path: '/api/meet/lessons/lesson-1/token',
        init: { method: 'POST', previewRole: 'teacher' },
      },
    ])
  })

  it('encodes the lesson id so a crafted URL cannot reach another API path', async () => {
    const paths: string[] = []
    await fetchMeetToken('a/../b?x=1', null, async (path) => {
      paths.push(path)
      return issued
    })
    expect(paths).toEqual(['/api/meet/lessons/a%2F..%2Fb%3Fx%3D1/token'])
  })

  it('lets an API failure through to the caller', async () => {
    const failure = new ApiError(409, { error: 'lesson_not_live' })
    await expect(
      fetchMeetToken('lesson-1', null, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
  })
})

describe('tokenFailure', () => {
  it.each([
    [401, 'forbidden'],
    [403, 'forbidden'],
    [404, 'forbidden'],
    [409, 'notLive'],
    [501, 'unconfigured'],
    [500, 'unavailable'],
    [502, 'unavailable'],
    [400, 'unavailable'],
  ] as const)('maps HTTP %i to %s', (status, failure) => {
    expect(tokenFailure(new ApiError(status, { error: 'x' }))).toBe(failure)
  })

  it('treats a network error or any other throw as unavailable', () => {
    expect(tokenFailure(new TypeError('Failed to fetch'))).toBe('unavailable')
    expect(tokenFailure('boom')).toBe('unavailable')
    expect(tokenFailure(null)).toBe('unavailable')
  })
})

describe('signalUrl', () => {
  it('uses wss on https pages and keeps the port', () => {
    expect(signalUrl({ protocol: 'https:', host: 'tilchi.uz' })).toBe(
      'wss://tilchi.uz/rtc',
    )
  })

  it('uses ws on http pages, such as the local compose stack', () => {
    expect(signalUrl({ protocol: 'http:', host: 'localhost:3000' })).toBe(
      'ws://localhost:3000/rtc',
    )
  })
})
