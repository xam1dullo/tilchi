import type { MyAssignment } from './attempt'
import {
  type GroupRecord,
  type LessonRecord,
  nextGroupLesson,
} from './classroom'

export type HomeNext = { lesson: LessonRecord; group: GroupRecord }

/**
 * What the home page leads with: the one lesson that matters now (live, else
 * the soonest scheduled), the open tests by deadline, and each group's next
 * lesson for the list. Pure, so the route only fetches and renders.
 */
export function homeView(input: {
  groups: GroupRecord[]
  lessonsByGroup: Record<string, LessonRecord[]>
  assignments: MyAssignment[]
  now: number
}) {
  const groups = input.groups.map((group) => ({
    group,
    nextLesson: nextGroupLesson(
      input.lessonsByGroup[group.id] ?? [],
      input.now,
    ),
  }))
  const next =
    groups
      .flatMap(({ group, nextLesson }) =>
        nextLesson ? [{ lesson: nextLesson, group }] : [],
      )
      .sort((a, b) => {
        if ((a.lesson.status === 'live') !== (b.lesson.status === 'live'))
          return a.lesson.status === 'live' ? -1 : 1
        return (
          Date.parse(a.lesson.scheduledAt) - Date.parse(b.lesson.scheduledAt)
        )
      })[0] ?? null
  const open = input.assignments
    .filter((a) => a.status === 'assigned')
    .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline))
  return {
    next,
    dueTests: open.slice(0, 3),
    moreTests: Math.max(0, open.length - 3),
    groups,
  }
}
