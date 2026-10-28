import { expect, it } from 'vitest'
import type { Actor } from '../authz/policy'
import { GroupsRepository } from '../groups/groups.repository'
import { GroupsService } from '../groups/groups.service'
import { uuidv7 } from '../id'
import type { OutboxWorker } from '../outbox/outbox.worker'
import { actorOf } from '../test/actors'
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
      actor: actorOf('teacher', teacher.id),
    })
    await groups.putMember(group.id, learner.id)
    const lessons = {
      visible: async (actor: Actor) => ({
        lesson: { id: 'l1', groupId: group.id, status: 'scheduled' },
        group: await groups.visible(actor, group.id),
      }),
      meetingForLesson: async () => null,
    } as unknown as LessonsService
    const controller = new LessonsController(
      groups,
      lessons,
      {} as OutboxWorker,
    )
    const detail = (actor: Actor) => controller.get('l1', actor)
    const learnerActor = actorOf('learner', learner.id)
    const teacherActor = actorOf('teacher', teacher.id)

    const asLearner = await detail(learnerActor)
    expect(asLearner.group).not.toHaveProperty('memberIds')
    expect(asLearner.group).toMatchObject({ learnerCount: 1 })
    expect((await detail(teacherActor)).group).toHaveProperty('memberIds')
  })
})
