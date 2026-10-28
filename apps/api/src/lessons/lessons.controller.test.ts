import { expect, it } from 'vitest'
import type { AuthService } from '../auth/auth.service'
import { GroupsRepository } from '../groups/groups.repository'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import type { RoomAdmin } from '../meet/room-admin'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { LessonsController } from './lessons.controller'
import type { LessonsService } from './lessons.service'

describeWithDatabase('LessonsController group serialization', (current) => {
  it('never gives a learner member ids on lesson detail', async () => {
    const db = current().database
    const users = new UsersRepository(db)
    const groups = new GroupsService(new GroupsRepository(db))
    const teacher = await users.ensure({
      id: uuidv7(),
      role: 'teacher',
      name: 'T',
    })
    const learner = await users.ensure({
      id: uuidv7(),
      role: 'learner',
      name: 'L',
    })
    const group = await groups.create({
      name: 'A1',
      actorId: teacher.id,
      role: 'teacher',
    })
    await groups.putMember(group.id, learner.id)
    const actors = new Map([
      ['teacher', { userId: teacher.id, role: 'teacher', name: 'T' }],
      ['learner', { userId: learner.id, role: 'learner', name: 'L' }],
    ])
    const auth = {
      read: async (token: string | undefined) =>
        actors.get(token ?? '') ?? null,
    } as unknown as AuthService
    const lessons = {
      get: async () => ({ id: 'l1', groupId: group.id }),
      meetingForLesson: async () => null,
    } as unknown as LessonsService
    const controller = new LessonsController(
      auth,
      groups,
      lessons,
      {} as RoomAdmin,
    )
    const detail = (who: string) =>
      controller.get('l1', `__Host-tilchi_sid=${who}`, undefined, undefined)

    const asLearner = await detail('learner')
    expect(asLearner.group).not.toHaveProperty('memberIds')
    expect(asLearner.group).toMatchObject({ learnerCount: 1 })
    expect((await detail('teacher')).group).toHaveProperty('memberIds')
  })
})
