import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import {
  ATTEMPT_STATUSES,
  assignError,
  loadAssessment,
  statusCounts,
  statusKey,
  toAssignBody,
} from './assignments'
import { copy } from './i18n'

// 2030-01-01 10:00 in Tashkent (UTC+5).
const now = new Date('2030-01-01T05:00:00Z')

describe('toAssignBody', () => {
  it('reads the deadline as Tashkent time', () => {
    expect(toAssignBody('t1', '2030-01-02T09:30', now)).toEqual({
      ok: true,
      body: { testId: 't1', deadline: '2030-01-02T04:30:00.000Z' },
    })
  })

  it('needs a test and a complete deadline', () => {
    expect(toAssignBody('', '2030-01-02T09:30', now)).toEqual({
      ok: false,
      error: 'assignTestRequired',
    })
    expect(toAssignBody('t1', '', now)).toEqual({
      ok: false,
      error: 'assignDeadlineInvalid',
    })
  })

  it('refuses a deadline now or in the past', () => {
    expect(toAssignBody('t1', '2030-01-01T10:00', now)).toEqual({
      ok: false,
      error: 'assignDeadlinePast',
    })
    expect(toAssignBody('t1', '2029-12-31T23:00', now)).toMatchObject({
      error: 'assignDeadlinePast',
    })
    expect(toAssignBody('t1', '2030-01-01T10:01', now).ok).toBe(true)
  })

  it('refuses a deadline more than 366 days ahead', () => {
    expect(toAssignBody('t1', '2031-01-02T10:00', now).ok).toBe(true)
    expect(toAssignBody('t1', '2031-01-02T10:01', now)).toEqual({
      ok: false,
      error: 'assignDeadlineInvalid',
    })
  })
})

describe('statusCounts', () => {
  it('counts every status, zero included', () => {
    expect(
      statusCounts([
        { status: 'assigned' },
        { status: 'graded' },
        { status: 'assigned' },
      ]),
    ).toEqual({ assigned: 2, submitted: 0, graded: 1, missed: 0 })
  })

  it('has copy for every status in every locale', () => {
    for (const status of ATTEMPT_STATUSES) {
      for (const locale of Object.values(copy)) {
        expect(locale[statusKey[status]]).toBeTruthy()
      }
    }
    expect(new Set(Object.values(statusKey)).size).toBe(4)
  })
})

describe('assignError', () => {
  it('maps the server codes and 403 to their own messages', () => {
    const cases: [ApiError, string][] = [
      [new ApiError(400, { error: 'invalid_assignment' }), 'assignInvalid'],
      [new ApiError(400, { error: 'invalid_test_id' }), 'assignTestRequired'],
      [
        new ApiError(400, { error: 'invalid_deadline' }),
        'assignDeadlineInvalid',
      ],
      [new ApiError(404, { error: 'not_found' }), 'assignNotFound'],
      [new ApiError(403, { error: 'forbidden' }), 'assignForbidden'],
    ]
    for (const [error, key] of cases) {
      expect(assignError(error)).toBe(key)
      for (const locale of Object.values(copy)) {
        expect(locale[key as keyof typeof locale]).toBeTruthy()
      }
    }
  })

  it('falls back to the generic message', () => {
    expect(assignError(new ApiError(400, { error: 'toString' }))).toBe(
      'courseUnavailable',
    )
    expect(assignError(new TypeError('network'))).toBe('courseUnavailable')
  })
})

describe('loadAssessment', () => {
  const none = { assignTest: false, viewAssignments: false }
  const both = { assignTest: true, viewAssignments: true }

  it('fetches nothing the server does not allow', async () => {
    const paths: string[] = []
    const get = async <T>(path: string) => {
      paths.push(path)
      return {} as T
    }
    expect(await loadAssessment(none, 'g1', get)).toEqual({
      tests: [],
      assignments: [],
    })
    expect(paths).toEqual([])
  })

  it('returns the data when allowed', async () => {
    const get = async <T>(path: string) =>
      (path === '/api/tests'
        ? { tests: [{ id: 't1' }] }
        : { assignments: [{ id: 'a1' }] }) as T
    const loaded = await loadAssessment(both, 'g1', get)
    expect(loaded.tests).toEqual([{ id: 't1' }])
    expect(loaded.assignments).toEqual([{ id: 'a1' }])
  })

  it('turns a failed fetch into null instead of failing the page', async () => {
    const get = async <T>(path: string): Promise<T> => {
      if (path === '/api/tests') throw new Error('boom')
      return { assignments: [] } as T
    }
    expect(await loadAssessment(both, 'g1', get)).toEqual({
      tests: null,
      assignments: [],
    })
  })
})
