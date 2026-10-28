import { describe, expect, it } from 'vitest'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import {
  DEMO_GROUP_ID,
  DEMO_GROUP_NAME,
  DEMO_LEARNER,
  DEMO_LESSON_ID,
  DEMO_TEACHER,
} from './policy'
import { seedClassroom } from './seed'

describe('seedClassroom', () => {
  it('puts one teacher, one learner, one group, and one scheduled lesson', () => {
    const groups = new GroupsService()
    const lessons = new LessonsService(groups)
    const first = seedClassroom({ groups, lessons })
    const second = seedClassroom({ groups, lessons })
    expect(first.group.id).toBe(DEMO_GROUP_ID)
    expect(first.group.name).toBe(DEMO_GROUP_NAME)
    expect(first.group.memberIds).toEqual([
      DEMO_TEACHER.userId,
      DEMO_LEARNER.userId,
    ])
    expect(first.lesson.id).toBe(DEMO_LESSON_ID)
    expect(first.lesson.status).toBe('scheduled')
    expect(second.group.id).toBe(first.group.id)
    expect(second.lesson.id).toBe(first.lesson.id)
    expect(groups.listForUser(DEMO_TEACHER.userId)).toHaveLength(1)
    expect(groups.listForUser(DEMO_LEARNER.userId)).toHaveLength(1)
  })
})
