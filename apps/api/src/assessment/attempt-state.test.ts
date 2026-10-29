import { describe, expect, it } from 'vitest'
import {
  type AttemptEvent,
  type AttemptStatus,
  acceptsAnswers,
  effectiveStatus,
  transition,
} from './attempt-state'

const deadline = new Date('2030-01-01T12:00:00Z')
const before = new Date('2030-01-01T11:59:59Z')
const exactly = deadline
const after = new Date('2030-01-01T12:00:01Z')

const STATUSES: AttemptStatus[] = ['assigned', 'submitted', 'graded', 'missed']
const EVENTS: AttemptEvent[] = ['submit', 'grade', 'sweep']

/** Every (status, event, timing) cell of the machine, written out. */
const TABLE: Record<string, { status: AttemptStatus; refused?: string }> = {
  'assigned submit before': { status: 'submitted' },
  'assigned submit exactly': { status: 'submitted' },
  'assigned submit after': { status: 'missed', refused: 'deadline_passed' },
  'submitted submit before': {
    status: 'submitted',
    refused: 'already_submitted',
  },
  'submitted submit after': {
    status: 'submitted',
    refused: 'already_submitted',
  },
  'graded submit before': { status: 'graded', refused: 'already_submitted' },
  'graded submit after': { status: 'graded', refused: 'already_submitted' },
  'missed submit before': { status: 'missed', refused: 'deadline_passed' },
  'missed submit after': { status: 'missed', refused: 'deadline_passed' },
  'assigned grade before': { status: 'assigned', refused: 'not_submitted' },
  'assigned grade after': { status: 'assigned', refused: 'not_submitted' },
  'submitted grade before': { status: 'graded' },
  'submitted grade after': { status: 'graded' },
  'graded grade before': { status: 'graded', refused: 'already_graded' },
  'graded grade after': { status: 'graded', refused: 'already_graded' },
  'missed grade before': { status: 'missed', refused: 'not_submitted' },
  'missed grade after': { status: 'missed', refused: 'not_submitted' },
  'assigned sweep before': { status: 'assigned' },
  'assigned sweep exactly': { status: 'assigned' },
  'assigned sweep after': { status: 'missed' },
  'submitted sweep before': { status: 'submitted' },
  'submitted sweep after': { status: 'submitted' },
  'graded sweep before': { status: 'graded' },
  'graded sweep after': { status: 'graded' },
  'missed sweep before': { status: 'missed' },
  'missed sweep after': { status: 'missed' },
}

describe('attempt state machine', () => {
  const times = { before, exactly, after }
  for (const [name, expected] of Object.entries(TABLE)) {
    const [status, event, when] = name.split(' ') as [
      AttemptStatus,
      AttemptEvent,
      keyof typeof times,
    ]
    it(name, () => {
      expect(transition(status, event, { now: times[when], deadline })).toEqual(
        expected,
      )
    })
  }

  it('is total: every status and event answers for every moment', () => {
    for (const status of STATUSES) {
      for (const event of EVENTS) {
        for (const now of [before, exactly, after]) {
          const next = transition(status, event, { now, deadline })
          expect(STATUSES).toContain(next.status)
        }
      }
    }
  })

  it('never leaves graded or submitted for missed, and never leaves missed', () => {
    for (const event of EVENTS) {
      for (const now of [before, after]) {
        expect(transition('graded', event, { now, deadline }).status).toBe(
          'graded',
        )
        expect(transition('missed', event, { now, deadline }).status).toBe(
          'missed',
        )
        expect(
          transition('submitted', event, { now, deadline }).status,
        ).not.toBe('missed')
      }
    }
  })

  it('sweeping twice changes nothing more', () => {
    const once = transition('assigned', 'sweep', { now: after, deadline })
    expect(transition(once.status, 'sweep', { now: after, deadline })).toEqual(
      once,
    )
  })
})

describe('acceptsAnswers and effectiveStatus', () => {
  it('accepts answers on the deadline instant, not after', () => {
    expect(acceptsAnswers('assigned', { now: exactly, deadline })).toBe(true)
    expect(acceptsAnswers('assigned', { now: after, deadline })).toBe(false)
    for (const status of ['submitted', 'graded', 'missed'] as const) {
      expect(acceptsAnswers(status, { now: before, deadline })).toBe(false)
    }
  })

  it('shows an overdue open attempt as missed', () => {
    expect(effectiveStatus('assigned', { now: after, deadline })).toBe('missed')
    expect(effectiveStatus('assigned', { now: before, deadline })).toBe(
      'assigned',
    )
    expect(effectiveStatus('submitted', { now: after, deadline })).toBe(
      'submitted',
    )
  })
})
