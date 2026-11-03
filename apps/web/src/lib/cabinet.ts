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
    {
      label: copy.cabinetTests,
      value: tests.length,
      hint: copy.cabinetTestsHint,
    },
    {
      label: copy.cabinetQuestions,
      value: questions.length,
      hint: copy.cabinetQuestionsHint,
    },
    {
      label: copy.cabinetPublishedQuestions,
      value: published,
      hint: copy.cabinetPublishedHint,
    },
    {
      label: copy.cabinetDraftQuestions,
      value: questions.length - published,
      hint: copy.cabinetDraftHint,
    },
  ]
}

export type AssignmentFilter = 'all' | AttemptStatus

/** Counts always describe the full loaded list, independent of the filter. */
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
