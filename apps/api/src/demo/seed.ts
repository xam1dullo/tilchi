import type { GroupsService } from '../groups/groups.service'
import type { LessonsService } from '../lessons/lessons.service'
import {
  DEMO_GROUP_ID,
  DEMO_GROUP_NAME,
  DEMO_LEARNER,
  DEMO_LESSON_ID,
  DEMO_SCHEDULED_AT,
  DEMO_TEACHER,
} from './policy'

export function seedClassroom(input: {
  groups: GroupsService
  lessons: LessonsService
}) {
  const group = input.groups.ensure({
    id: DEMO_GROUP_ID,
    name: DEMO_GROUP_NAME,
    actorId: DEMO_TEACHER.userId,
  })
  input.groups.putMember(group.id, DEMO_LEARNER.userId)
  const lesson = input.lessons.ensure({
    id: DEMO_LESSON_ID,
    groupId: group.id,
    scheduledAt: DEMO_SCHEDULED_AT,
  })
  return { group, lesson }
}
