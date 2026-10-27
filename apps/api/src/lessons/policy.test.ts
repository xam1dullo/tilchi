import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_HORIZON_MS,
  SCHEDULE_PAST_TOLERANCE_MS,
  TRANSITIONS,
  parseScheduledAt,
} from './policy'

const NOW = new Date('2026-10-27T12:00:00Z')
const parse = (scheduledAt: unknown, now = NOW) =>
  parseScheduledAt({ scheduledAt }, now)

describe('parseScheduledAt', () => {
  it('accepts an offset and returns the same instant', () => {
    expect(parse('2026-10-28T09:00:00+05:00')).toEqual({
      ok: true,
      value: new Date('2026-10-28T04:00:00.000Z'),
    })
  })

  it.each([
    ['2026-10-28T09:00:00Z', '2026-10-28T09:00:00.000Z'],
    ['2026-10-28T09:00Z', '2026-10-28T09:00:00.000Z'],
    ['2026-10-28T09:00:00.500Z', '2026-10-28T09:00:00.500Z'],
    ['2026-10-28T09:00:00-03:30', '2026-10-28T12:30:00.000Z'],
  ])('accepts %s', (input, instant) => {
    expect(parse(input)).toEqual({ ok: true, value: new Date(instant) })
  })

  it.each([
    [undefined],
    [null],
    [12],
    [{}],
    [['2026-10-28T09:00:00Z']],
    ['tomorrow'],
    ['2026-10-28'],
    ['2026-10-28T09:00:00'],
    ['2026-10-28 09:00:00Z'],
    ['2026-02-30T09:00:00Z'],
    ['2027-02-29T09:00:00Z'],
    ['2026-13-01T09:00:00Z'],
    ['2026-00-10T09:00:00Z'],
    ['2026-10-00T09:00:00Z'],
    ['2026-04-31T09:00:00Z'],
    ['2026-10-28T24:00:00Z'],
    ['2026-10-28T25:00:00Z'],
    ['2026-10-28T09:60:00Z'],
    ['2026-10-28T09:00:60Z'],
    ['2026-10-28T09:00:00+99:00'],
    ['2026-10-28T09:00:00+05:60'],
    [' 2026-10-28T09:00:00Z'],
  ])('refuses %j', (value) => {
    expect(parse(value)).toEqual({ ok: false, status: 400, error: 'bad_time' })
  })

  it.each([[null], [[]], ['2026-10-28T09:00:00Z'], [undefined]])(
    'refuses a body that is not an object: %j',
    (body) => {
      expect(parseScheduledAt(body, NOW)).toMatchObject({
        ok: false,
        error: 'bad_time',
      })
    },
  )

  it('knows a leap day', () => {
    const now = new Date('2028-01-15T00:00:00Z')
    expect(parse('2028-02-29T10:00:00Z', now).ok).toBe(true)
  })

  it('tolerates a day in the past, no more', () => {
    const edge = new Date(NOW.getTime() - SCHEDULE_PAST_TOLERANCE_MS)
    expect(parse(edge.toISOString()).ok).toBe(true)
    const tooOld = new Date(edge.getTime() - 1)
    expect(parse(tooOld.toISOString())).toMatchObject({ ok: false })
  })

  it('looks ahead a year, no more', () => {
    const edge = new Date(NOW.getTime() + SCHEDULE_HORIZON_MS)
    expect(parse(edge.toISOString()).ok).toBe(true)
    const tooFar = new Date(edge.getTime() + 1)
    expect(parse(tooFar.toISOString())).toMatchObject({ ok: false })
  })
})

describe('lesson transitions', () => {
  it('only moves forward: scheduled to live to ended, or scheduled to cancelled', () => {
    expect(TRANSITIONS.start).toEqual({
      from: 'scheduled',
      to: 'live',
      error: 'lesson_not_scheduled',
    })
    expect(TRANSITIONS.end).toEqual({
      from: 'live',
      to: 'ended',
      error: 'lesson_not_live',
    })
    expect(TRANSITIONS.cancel).toEqual({
      from: 'scheduled',
      to: 'cancelled',
      error: 'lesson_not_scheduled',
    })
  })
})
