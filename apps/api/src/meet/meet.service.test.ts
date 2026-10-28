import { RoomServiceClient } from 'livekit-server-sdk'
import { afterEach, expect, it, vi } from 'vitest'
import { attendanceEvents } from '../db/schema'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { GroupsRepository } from '../groups/groups.repository'
import { LessonsRepository } from '../lessons/lessons.repository'
import { DEMO_LEARNER, DEMO_TEACHER } from '../demo/policy'
import { seedClassroom } from '../demo/seed'
import type { Actor } from '../groups/access'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import { AttendanceRepository } from './attendance.repository'
import { MeetService } from './meet.service'
import { RoomAdmin } from './room-admin'

describeWithDatabase('MeetService', (current) => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('mints a room token for a live member and never embeds a session secret', async () => {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessons = new LessonsService(groups, new LessonsRepository(db))
    const meet = new MeetService(
      groups,
      lessons,
      new AttendanceRepository(db),
      new RoomAdmin(),
    )
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
    const meet = new MeetService(
      groups,
      lessons,
      new AttendanceRepository(db),
      new RoomAdmin(),
    )
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

  it('records a token event for each minted token, and none when refused', async () => {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessons = new LessonsService(groups, new LessonsRepository(db))
    const meet = new MeetService(
      groups,
      lessons,
      new AttendanceRepository(db),
      new RoomAdmin(),
    )
    const { lesson } = await seedClassroom({ users, groups, lessons })
    const input = {
      lessonId: lesson.id,
      actor: DEMO_LEARNER,
      apiKey: 'devkey',
      apiSecret: 'devsecret',
    }
    await expect(meet.tokenForLesson(input)).rejects.toMatchObject({
      status: 409,
    })
    await lessons.start({ lessonId: lesson.id, role: 'teacher' })
    await meet.tokenForLesson(input)
    const rows = await db.db.select().from(attendanceEvents)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      lessonId: lesson.id,
      userId: DEMO_LEARNER.userId,
      kind: 'token',
      livekitEventId: null,
    })
  })

  it('lets only the Group teacher or an admin mute or remove, and only while live', async () => {
    vi.stubEnv('LIVEKIT_API_KEY', 'devkey')
    vi.stubEnv('LIVEKIT_API_SECRET', 'devsecret')
    const remove = vi
      .spyOn(RoomServiceClient.prototype, 'removeParticipant')
      .mockResolvedValue()
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessons = new LessonsService(groups, new LessonsRepository(db))
    const meet = new MeetService(
      groups,
      lessons,
      new AttendanceRepository(db),
      new RoomAdmin(),
    )
    const { lesson } = await seedClassroom({ users, groups, lessons })
    const kick = (actor: Actor) =>
      meet.moderate({
        lessonId: lesson.id,
        actor,
        targetUserId: DEMO_LEARNER.userId,
        action: 'remove',
      })
    await expect(kick(DEMO_TEACHER)).rejects.toMatchObject({ status: 409 })
    await lessons.start({ lessonId: lesson.id, role: 'teacher' })
    await expect(kick(DEMO_LEARNER)).rejects.toMatchObject({ status: 403 })
    await expect(
      kick({ userId: 'stranger', role: 'teacher', name: 'X' }),
    ).rejects.toMatchObject({ status: 404 })
    expect(remove).not.toHaveBeenCalled()
    await kick(DEMO_TEACHER)
    expect(remove).toHaveBeenCalledExactlyOnceWith(
      `lesson-${lesson.id}`,
      DEMO_LEARNER.userId,
    )
  })
})
