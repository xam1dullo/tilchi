import type { GroupRecord } from './classroom'
import type { Copy } from './i18n'
import type { AppRole } from './nav'
import type { QuestionRecord, TestSummary } from './question-form'

export function groupStats(groups: GroupRecord[], copy: Copy, role: AppRole) {
  const members = groups.reduce((n, group) => n + group.learnerCount, 0)
  const capacity = groups.reduce((n, group) => n + group.capacity, 0)
  const hint =
    role === 'admin' ? copy.cabinetAllGroupsHint : copy.cabinetGroupsHint
  const membership = [
    {
      label: copy.cabinetGroups,
      value: groups.length,
      hint,
    },
    { label: copy.members, value: members, hint },
  ]
  if (role === 'learner') return membership
  return [
    ...membership,
    {
      label: copy.cabinetCapacity,
      value: capacity,
      hint: copy.cabinetCapacityHint,
    },
    {
      label: copy.cabinetAvailable,
      value: groups.reduce(
        (n, group) => n + Math.max(0, group.capacity - group.learnerCount),
        0,
      ),
      hint: copy.cabinetAvailableHint,
    },
  ]
}

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
