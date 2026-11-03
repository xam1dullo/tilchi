import { describe, expect, it } from 'vitest'
import { summarizeAttendance } from './attendance'

const t = (min: number) => new Date(Date.UTC(2026, 0, 1, 10, min))
const window = { start: t(0), end: t(60) }
const ev = (userId: string, kind: 'join' | 'leave' | 'token', min: number) => ({
  userId,
  kind,
  at: t(min),
})

describe('summarizeAttendance', () => {
  it('sums join→leave intervals per user and marks present', () => {
    const rows = summarizeAttendance(
      [
        ev('a', 'join', 5),
        ev('a', 'leave', 15),
        ev('a', 'join', 20),
        ev('a', 'leave', 30),
      ],
      window,
    )
    expect(rows).toEqual([{ userId: 'a', present: true, seconds: 1200 }])
  })

  it('ignores a duplicate join and a leave without a join', () => {
    expect(
      summarizeAttendance(
        [
          ev('a', 'join', 5),
          ev('a', 'join', 8),
          ev('a', 'leave', 15),
          ev('a', 'leave', 16),
        ],
        window,
      ),
    ).toEqual([{ userId: 'a', present: true, seconds: 600 }])
    expect(summarizeAttendance([ev('b', 'leave', 15)], window)).toEqual([
      { userId: 'b', present: false, seconds: 0 },
    ])
  })

  it('counts an open join until the window end and clips to the window', () => {
    expect(summarizeAttendance([ev('a', 'join', 50)], window)).toEqual([
      { userId: 'a', present: true, seconds: 600 },
    ])
    // Joined before the lesson started, left after it ended: only the window counts.
    expect(
      summarizeAttendance([ev('a', 'join', -10), ev('a', 'leave', 70)], window),
    ).toEqual([{ userId: 'a', present: true, seconds: 3600 }])
  })

  it('is not present on a join outside the window', () => {
    expect(summarizeAttendance([ev('a', 'join', 65)], window)).toEqual([
      { userId: 'a', present: false, seconds: 0 },
    ])
    expect(
      summarizeAttendance([ev('a', 'join', -10), ev('a', 'leave', -5)], window),
    ).toEqual([{ userId: 'a', present: false, seconds: 0 }])
  })

  it('orders events by time whatever the input order and skips token events', () => {
    expect(
      summarizeAttendance(
        [ev('a', 'leave', 15), ev('a', 'token', 1), ev('a', 'join', 5)],
        window,
      ),
    ).toEqual([{ userId: 'a', present: true, seconds: 600 }])
    expect(summarizeAttendance([ev('a', 'token', 1)], window)).toEqual([
      { userId: 'a', present: false, seconds: 0 },
    ])
  })
})
