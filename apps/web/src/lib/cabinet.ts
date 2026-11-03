import { statusCounts, type AttemptStatus } from './assignments'
import type { MyAssignment } from './attempt'
import type { Copy } from './i18n'
import type { QuestionRecord, TestSummary } from './question-form'

export function testStats(
  tests: TestSummary[],
  questions: QuestionRecord[],
  copy: Copy,
) {
  const published = questions.filter((q) => q.status === 'published').length
  return [
    { label: copy.figTests, value: tests.length },
    { label: copy.figQuestions, value: questions.length },
    { label: copy.figPublished, value: published },
    { label: copy.figDrafts, value: questions.length - published },
  ]
}

export type AssignmentFilter = 'all' | AttemptStatus

export function assignmentView(
  assignments: MyAssignment[],
  filter: AssignmentFilter,
) {
  return {
    counts: { all: assignments.length, ...statusCounts(assignments) },
    rows:
      filter === 'all'
        ? assignments
        : assignments.filter((row) => row.status === filter),
  }
}
