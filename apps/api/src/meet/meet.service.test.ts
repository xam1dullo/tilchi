import { describe, expect, it } from 'vitest'
import { DEMO_LEARNER, DEMO_TEACHER } from '../demo/policy'
import { seedClassroom } from '../demo/seed'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import { MeetService } from './meet.service'

describe('MeetService', () => {
  it('mints a room token for a live member and never embeds a session secret', async () => {
    const groups = new GroupsService()
    const lessons = new LessonsService(groups)
    const meet = new MeetService(groups, lessons)
    const { lesson } = seedClassroom({ groups, lessons })
    const sessionSecret = 'session-secret-value'
    await expect(
      meet.tokenForLesson({
        lessonId: lesson.id,
        actor: DEMO_LEARNER,
        apiKey: 'devkey',
        apiSecret: 'devsecret',
      }),
    ).rejects.toMatchObject({ status: 409 })
    lessons.start({ lessonId: lesson.id, role: 'teacher' })
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
    const groups = new GroupsService()
    const lessons = new LessonsService(groups)
    const meet = new MeetService(groups, lessons)
    const { lesson } = seedClassroom({ groups, lessons })
    lessons.start({ lessonId: lesson.id, role: 'teacher' })
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
