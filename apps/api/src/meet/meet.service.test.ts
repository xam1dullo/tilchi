import { expect, it } from 'vitest'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { GroupsRepository } from '../groups/groups.repository'
import { LessonsRepository } from '../lessons/lessons.repository'
import { DEMO_LEARNER, DEMO_TEACHER } from '../demo/policy'
import { seedClassroom } from '../demo/seed'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import { MeetService } from './meet.service'

describeWithDatabase('MeetService', (current) => {
  it('mints a room token for a live member and never embeds a session secret', async () => {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessons = new LessonsService(groups, new LessonsRepository(db))
    const meet = new MeetService(groups, lessons)
    const { lesson } = await seedClassroom({ users, groups, lessons })
    const sessionSecret = 'session-secret-value'
    await expect(
      meet.tokenForLesson({
        lessonId: lesson.id,
        actor: DEMO_LEARNER,
        apiKey: 'devkey',
        apiSecret: 'devsecret',
      }),
    ).rejects.toMatchObject({ status: 409 })
    await lessons.start({ lessonId: lesson.id, role: 'teacher' })
    const issued = await meet.tokenForLesson({
      lessonId: lesson.id,
      actor: DEMO_LEARNER,
      apiKey: 'devkey',
      apiSecret: 'devsecret',
    })
    expect(issued.room).toContain(lesson.id)
    expect(issued.token.split('.')).toHaveLength(3)
    expect(JSON.stringify(issued)).not.toContain(sessionSecret)
    expect(issued.token).not.toContain(sessionSecret)
    const teacher = await meet.tokenForLesson({
      lessonId: lesson.id,
      actor: DEMO_TEACHER,
      apiKey: 'devkey',
      apiSecret: 'devsecret',
    })
    expect(teacher.room).toBe(issued.room)
  })

  it('refuses strangers and missing LiveKit credentials', async () => {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessons = new LessonsService(groups, new LessonsRepository(db))
    const meet = new MeetService(groups, lessons)
    const { lesson } = await seedClassroom({ users, groups, lessons })
    await lessons.start({ lessonId: lesson.id, role: 'teacher' })
    await expect(
      meet.tokenForLesson({
        lessonId: lesson.id,
        actor: {
          userId: 'stranger',
          role: 'learner',
          name: 'X',
        },
        apiKey: 'devkey',
        apiSecret: 'devsecret',
      }),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      meet.tokenForLesson({
        lessonId: lesson.id,
        actor: DEMO_TEACHER,
        apiKey: '',
        apiSecret: '',
      }),
    ).rejects.toMatchObject({ status: 501 })
  })
})
