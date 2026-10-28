import { expect, it } from 'vitest'
import { GroupsRepository } from '../groups/groups.repository'
import { GroupsService } from '../groups/groups.service'
import { LessonsRepository } from '../lessons/lessons.repository'
import { LessonsService } from '../lessons/lessons.service'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import {
  DEMO_ADMIN,
  DEMO_GROUP_ID,
  DEMO_GROUP_NAME,
  DEMO_LEARNER,
  DEMO_LESSON_ID,
  DEMO_TEACHER,
} from './policy'
import { seedClassroom } from './seed'

describeWithDatabase('seedClassroom', (current) => {
  const parts = () => {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessons = new LessonsService(groups, new LessonsRepository(db))
    return { users, groups, lessons }
  }

  it('puts one teacher, one learner, one group, and one scheduled lesson', async () => {
    const { users, groups, lessons } = parts()
    const first = await seedClassroom({ users, groups, lessons })
    const second = await seedClassroom({ users, groups, lessons })
    expect(first.group.id).toBe(DEMO_GROUP_ID)
    expect(first.group.name).toBe(DEMO_GROUP_NAME)
    expect(first.group.memberIds).toEqual([
      DEMO_TEACHER.userId,
      DEMO_LEARNER.userId,
    ])
    expect(first.lesson.id).toBe(DEMO_LESSON_ID)
    expect(first.lesson.status).toBe('scheduled')
    expect(second).toEqual(first)
    expect(await groups.listForUser(DEMO_TEACHER.userId)).toHaveLength(1)
    expect(await groups.listForUser(DEMO_LEARNER.userId)).toHaveLength(1)
    expect(await groups.listForUser(DEMO_ADMIN.userId)).toHaveLength(0)
  })

  it('writes the three demo users through the repository', async () => {
    const { users, groups, lessons } = parts()
    await seedClassroom({ users, groups, lessons })
    for (const demo of [DEMO_TEACHER, DEMO_LEARNER, DEMO_ADMIN]) {
      expect(await users.get(demo.userId)).toEqual({
        id: demo.userId,
        telegramUserId: null,
        role: demo.role,
        name: demo.name,
      })
    }
  })
})
