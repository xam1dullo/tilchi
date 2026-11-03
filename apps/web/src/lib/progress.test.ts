import { describe, expect, it } from 'vitest'
import { learnerProgress } from './progress'

const held = { lessonsHeld: 5, lessonsPresent: 4 }
const attempt = (
  status: 'assigned' | 'submitted' | 'graded' | 'missed',
  score: number | null = null,
) => ({ status, score })

describe('learnerProgress', () => {
  it('reads attendance, graded-of-assigned tests and the mean graded score', () => {
    expect(
      learnerProgress(held, [
        attempt('graded', 8),
        attempt('graded', 7),
        attempt('submitted'),
      ]),
    ).toEqual({ attendance: '4/5', tests: '2/3', average: '7.5' })
  })

  it('counts a missed test as assigned but never graded', () => {
    expect(
      learnerProgress(held, [attempt('missed'), attempt('graded', 10)]),
    ).toEqual({
      attendance: '4/5',
      tests: '1/2',
      average: '10',
    })
  })

  it('omits a figure whose denominator is zero', () => {
    expect(learnerProgress(undefined, [])).toEqual({})
    expect(learnerProgress({ lessonsHeld: 0, lessonsPresent: 0 }, [])).toEqual(
      {},
    )
    expect(learnerProgress(undefined, [attempt('assigned')])).toEqual({
      tests: '0/1',
    })
    expect(learnerProgress(held, [])).toEqual({ attendance: '4/5' })
  })

  it('rounds the average to one decimal and skips graded rows without a score', () => {
    expect(
      learnerProgress(undefined, [
        attempt('graded', 7),
        attempt('graded', 8),
        attempt('graded', 8),
      ]),
    ).toEqual({ tests: '3/3', average: '7.7' })
    expect(learnerProgress(undefined, [attempt('graded', null)])).toEqual({
      tests: '1/1',
    })
  })
})
