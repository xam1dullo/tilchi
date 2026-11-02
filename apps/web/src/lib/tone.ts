import type { AttemptStatus } from './assignments'
import type { LessonStatus } from './classroom'

// Tag colour carries meaning: the brand red is the teacher's mark (a grade),
// amber is something missed. Every routine state stays neutral.
export type TagTone = 'mark' | 'warn' | undefined

export function statusTone(status: AttemptStatus | LessonStatus): TagTone {
  if (status === 'graded') return 'mark'
  if (status === 'missed' || status === 'cancelled') return 'warn'
  return undefined
}
