import { expect, it } from 'vitest'
import { GroupsRepository } from '../groups/groups.repository'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import { LessonsRepository } from '../lessons/lessons.repository'
import { LessonsService } from '../lessons/lessons.service'
import { actorOf } from '../test/actors'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { AttendanceRepository } from './attendance.repository'
import { AttendanceService } from './attendance.service'

const AT = '2026-11-01T09:00:00+05:00'
const t = (min: number) => new Date(Date.UTC(2026, 10, 1, 4, min))

describeWithDatabase('AttendanceService', (current) => {
  const setup = async () => {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const lessonsRepo = new LessonsRepository(db)
    const lessons = new LessonsService(groups, lessonsRepo)
    const events = new AttendanceRepository(db)
    const service = new AttendanceService(groups, lessons, events)
    const teacher = await users.ensure({
      id: uuidv7(),
      role: 'teacher',
      name: 'T',
    })
    const group = await groups.create({
      name: 'A1',
      actor: actorOf('teacher', teacher.id),
    })
    const ali = await users.ensure({
      id: uuidv7(),
      role: 'learner',
      name: 'Ali',
    })
    const vali = await users.ensure({
      id: uuidv7(),
      role: 'learner',
      name: null as unknown as string,
    })
    await groups.putMember(group.id, ali.id)
    await groups.putMember(group.id, vali.id)
    const lessonAt = async (scheduledAt: string, live = true) => {
      const lesson = await lessons.create({
        groupId: group.id,
        scheduledAt,
        actor: actorOf('admin'),
      })
      if (live) await lessonsRepo.start(lesson.id, t(0))
      return lesson
    }
    return {
      service,
      lessonsRepo,
      events,
      group,
      teacher: actorOf('teacher', teacher.id),
      ali: actorOf('learner', ali.id),
      vali: actorOf('learner', vali.id),
      lessonAt,
    }
  }

  it('reports per-lesson presence and seconds, learners only, names as members show them', async () => {
    const { service, lessonsRepo, events, teacher, ali, vali, lessonAt } =
      await setup()
    const lesson = await lessonAt(AT)
    await events.record({
      lessonId: lesson.id,
      userId: ali.userId,
      kind: 'join',
      at: t(5),
    })
    await events.record({
      lessonId: lesson.id,
      userId: ali.userId,
      kind: 'leave',
      at: t(25),
    })
    await events.record({
      lessonId: lesson.id,
      userId: teacher.userId,
      kind: 'join',
      at: t(0),
    })
    await lessonsRepo.end(lesson.id, t(60))
    const { attendance } = await service.forLesson(teacher, lesson.id)
    expect(attendance).toEqual([
      { userId: ali.userId, name: 'Ali', present: true, seconds: 1200 },
      { userId: vali.userId, name: null, present: false, seconds: 0 },
    ])
    // A learner sees only their own row.
    expect((await service.forLesson(vali, lesson.id)).attendance).toEqual([
      { userId: vali.userId, name: null, present: false, seconds: 0 },
    ])
    await expect(
      service.forLesson(actorOf('learner', uuidv7()), lesson.id),
    ).rejects.toMatchObject({ status: 404 })
    await expect(service.forLesson(teacher, uuidv7())).rejects.toMatchObject({
      status: 404,
    })
  })

  it('counts a live lesson up to now and an ended one up to its end', async () => {
    const { service, lessonsRepo, events, teacher, ali, lessonAt } =
      await setup()
    const lesson = await lessonAt(AT)
    await events.record({
      lessonId: lesson.id,
      userId: ali.userId,
      kind: 'join',
      at: t(10),
    })
    const live = await service.forLesson(teacher, lesson.id, t(20))
    expect(live.attendance[0]).toMatchObject({
      userId: ali.userId,
      seconds: 600,
    })
    await lessonsRepo.end(lesson.id, t(40))
    const ended = await service.forLesson(teacher, lesson.id, t(90))
    expect(ended.attendance[0]).toMatchObject({
      userId: ali.userId,
      seconds: 1800,
    })
  })

  it('summarises ended lessons per member for the group, own row only for a learner', async () => {
    const {
      service,
      lessonsRepo,
      events,
      group,
      teacher,
      ali,
      vali,
      lessonAt,
    } = await setup()
    const first = await lessonAt(AT)
    const second = await lessonAt('2026-11-02T09:00:00+05:00')
    const stillLive = await lessonAt('2026-11-03T09:00:00+05:00')
    await lessonAt('2026-11-04T09:00:00+05:00', false)
    for (const [lesson, who] of [
      [first, ali],
      [first, vali],
      [second, ali],
      [stillLive, vali],
    ] as const) {
      await events.record({
        lessonId: lesson.id,
        userId: who.userId,
        kind: 'join',
        at: t(1),
      })
    }
    await lessonsRepo.end(first.id, t(60))
    await lessonsRepo.end(second.id, t(60))
    const all = await service.forGroup(teacher, group.id)
    expect(all).toEqual({
      attendance: [
        { userId: ali.userId, name: 'Ali', lessonsHeld: 2, lessonsPresent: 2 },
        { userId: vali.userId, name: null, lessonsHeld: 2, lessonsPresent: 1 },
      ],
      lessons: [
        { lessonId: first.id, present: 2 },
        { lessonId: second.id, present: 1 },
      ],
    })
    expect(await service.forGroup(vali, group.id)).toEqual({
      attendance: [
        { userId: vali.userId, name: null, lessonsHeld: 2, lessonsPresent: 1 },
      ],
      lessons: [],
    })
    await expect(
      service.forGroup(actorOf('teacher', uuidv7()), group.id),
    ).rejects.toMatchObject({ status: 404 })
  })
})
