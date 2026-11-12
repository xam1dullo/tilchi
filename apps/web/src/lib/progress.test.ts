import { describe, expect, it } from 'vitest'
import { learnerProgress } from './progress'

const held = { lessonsHeld: 5, lessonsPresent: 4 }
const attempt = (
  status: 'assigned' | 'submitted' | 'graded' | 'missed',
  score: number | null = null,
  maxScore = 10,
) => ({ status, score, maxScore })

describe('learnerProgress', () => {
  it('reads attendance, graded-of-assigned tests and the graded share of points', () => {
    expect(
      learnerProgress(held, [
        attempt('graded', 8),
        attempt('graded', 7),
        attempt('submitted'),
      ]),
    ).toEqual({ attendance: '4/5', tests: '2/3', average: '75%' })
  })

  it('weighs each test by its own maximum, not by raw points', () => {
    // 1 of 1 and 5 of 10: 6 of 11 points, not a mean of 100% and 50%.
    expect(
      learnerProgress(undefined, [
        attempt('graded', 1, 1),
        attempt('graded', 5, 10),
      ]).average,
    ).toBe('55%')
  })

  it('counts a missed test as assigned but never graded', () => {
    expect(
      learnerProgress(held, [attempt('missed'), attempt('graded', 10)]),
    ).toEqual({
      attendance: '4/5',
      tests: '1/2',
      average: '100%',
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

  it('rounds to a whole percent and skips graded rows without a score or a maximum', () => {
    expect(
      learnerProgress(undefined, [
        attempt('graded', 7),
        attempt('graded', 8),
        attempt('graded', 8),
      ]),
    ).toEqual({ tests: '3/3', average: '77%' })
    expect(learnerProgress(undefined, [attempt('graded', null)])).toEqual({
      tests: '1/1',
    })
    expect(learnerProgress(undefined, [attempt('graded', 0, 0)])).toEqual({
      tests: '1/1',
    })
  })
})
