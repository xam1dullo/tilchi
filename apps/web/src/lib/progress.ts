export type ProgressAttempt = {
  status: string
  score: number | null
  maxScore: number
}

export type LearnerProgress = {
  attendance?: string
  tests?: string
  average?: string
}

/**
 * One learner's figures for a group, as "4/5" strings: lessons present of
 * held, tests graded of assigned (a missed test was assigned too), and the
 * graded points earned of points possible as a whole percent (each test has
 * its own maxScore). A figure with nothing behind it is left out, so a fresh
 * group shows no row of zeros.
 */
export function learnerProgress(
  attendance: { lessonsHeld: number; lessonsPresent: number } | undefined,
  attempts: readonly ProgressAttempt[],
): LearnerProgress {
  const out: LearnerProgress = {}
  if (attendance && attendance.lessonsHeld > 0) {
    out.attendance = `${attendance.lessonsPresent}/${attendance.lessonsHeld}`
  }
  const graded = attempts.filter((a) => a.status === 'graded')
  if (attempts.length > 0) out.tests = `${graded.length}/${attempts.length}`
  const scored = graded.filter((a) => a.score !== null && a.maxScore > 0)
  const possible = scored.reduce((sum, a) => sum + a.maxScore, 0)
  if (possible > 0) {
    const earned = scored.reduce((sum, a) => sum + (a.score ?? 0), 0)
    out.average = `${Math.round((earned / possible) * 100)}%`
  }
  return out
}
