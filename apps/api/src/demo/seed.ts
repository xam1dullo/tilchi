import type { GroupsService } from '../groups/groups.service'
import type { LessonsService } from '../lessons/lessons.service'
import type { UsersRepository } from '../users/users.repository'
import {
  DEMO_ADMIN,
  DEMO_GROUP_ID,
  DEMO_GROUP_NAME,
  DEMO_LEARNER,
  DEMO_LESSON_ID,
  DEMO_SCHEDULED_AT,
  DEMO_TEACHER,
} from './policy'

/** Writes through the same repositories as the API, so running it twice changes nothing. */
export async function seedClassroom(input: {
  users: UsersRepository
  groups: GroupsService
  lessons: LessonsService
}) {
  for (const demo of [DEMO_TEACHER, DEMO_LEARNER, DEMO_ADMIN]) {
    await input.users.ensure({
      id: demo.userId,
      role: demo.role,
      name: demo.name,
    })
  }
  const created = await input.groups.ensure({
    id: DEMO_GROUP_ID,
    name: DEMO_GROUP_NAME,
    actorId: DEMO_TEACHER.userId,
  })
  const group = await input.groups.putMember(created.id, DEMO_LEARNER.userId)
  const lesson = await input.lessons.ensure({
    id: DEMO_LESSON_ID,
    groupId: group.id,
    scheduledAt: DEMO_SCHEDULED_AT,
  })
  return { group, lesson }
}
