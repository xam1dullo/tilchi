export type ProgressAttempt = { status: string; score: number | null }

export type LearnerProgress = {
  attendance?: string
  tests?: string
  average?: string
}

/**
 * One learner's figures for a group, as "4/5" strings: lessons present of
 * held, tests graded of assigned (a missed test was assigned too), and the
 * mean graded score to one decimal. A figure with nothing behind it is left
 * out, so a fresh group shows no row of zeros.
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
  const scores = graded.flatMap((a) => (a.score === null ? [] : [a.score]))
  if (scores.length > 0) {
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length
    out.average = String(Math.round(mean * 10) / 10)
  }
  return out
}
