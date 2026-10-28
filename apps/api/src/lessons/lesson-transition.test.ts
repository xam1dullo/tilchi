import { describe, expect, it } from 'vitest'
import {
  type LessonCommand,
  type LessonRow,
  lessonTransition,
} from './lesson-transition'

const NOW = new Date('2026-11-01T05:00:00Z')
const LATER = new Date('2026-11-03T05:00:00Z')
const STATUSES = ['scheduled', 'live', 'ended', 'cancelled'] as const
const row = (status: LessonRow['status']): LessonRow => ({
  status,
  startedAt: null,
  endedAt: null,
})

const COMMANDS: Record<string, LessonCommand> = {
  start: { type: 'start' },
  end: { type: 'end' },
  cancel: { type: 'cancel' },
  reschedule: { type: 'reschedule', scheduledAt: LATER },
}

// [command][status] -> 'next' | 'same' | 'refused'
const TABLE = {
  start: {
    scheduled: 'next',
    live: 'same',
    ended: 'refused',
    cancelled: 'refused',
  },
  end: {
    scheduled: 'refused',
    live: 'next',
    ended: 'same',
    cancelled: 'refused',
  },
  cancel: {
    scheduled: 'next',
    live: 'refused',
    ended: 'refused',
    cancelled: 'same',
  },
  reschedule: {
    scheduled: 'next',
    live: 'refused',
    ended: 'refused',
    cancelled: 'refused',
  },
} as const

describe('lessonTransition', () => {
  for (const [name, command] of Object.entries(COMMANDS)) {
    for (const status of STATUSES) {
      const expected = TABLE[name as keyof typeof TABLE][status]
      it(`${name} on ${status} is ${expected}`, () => {
        expect(lessonTransition(row(status), command, NOW).kind).toBe(expected)
      })
    }
  }

  it('sets the status and the time that goes with it', () => {
    expect(lessonTransition(row('scheduled'), COMMANDS.start, NOW)).toEqual({
      kind: 'next',
      patch: { status: 'live', startedAt: NOW },
    })
    expect(lessonTransition(row('live'), COMMANDS.end, NOW)).toEqual({
      kind: 'next',
      patch: { status: 'ended', endedAt: NOW },
    })
    expect(lessonTransition(row('scheduled'), COMMANDS.cancel, NOW)).toEqual({
      kind: 'next',
      patch: { status: 'cancelled', cancelledAt: NOW },
    })
    expect(
      lessonTransition(row('scheduled'), COMMANDS.reschedule, NOW),
    ).toEqual({ kind: 'next', patch: { scheduledAt: LATER } })
  })

  it('keeps the first start time when a live lesson is started again', () => {
    const first = new Date('2026-11-01T04:00:00Z')
    expect(
      lessonTransition(
        { ...row('live'), startedAt: first },
        COMMANDS.start,
        NOW,
      ).kind,
    ).toBe('same')
  })
})
