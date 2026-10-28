import { expect, it } from 'vitest'
import { uuidv7 } from '../id'
import { actorOf } from '../test/actors'
import { describeWithDatabase } from '../test/postgres'
import { UsersRepository } from '../users/users.repository'
import { NotificationsRepository } from './notifications.repository'
import { NotificationsService } from './notifications.service'

describeWithDatabase('web inbox access', (current) => {
  async function setup() {
    const db = current().database
    const users = new UsersRepository(db)
    const repo = new NotificationsRepository(db)
    const service = new NotificationsService(repo)
    const make = async (name: string) =>
      (await users.ensure({ id: uuidv7(), role: 'learner', name })).id
    const [ada, bob] = [await make('Ada'), await make('Bob')]
    const add = async (userId: string, title: string) => {
      await repo.add({
        outboxId: null,
        userId,
        event: 'lesson.scheduled',
        title,
        body: 'b',
        link: null,
      })
      const found = (await repo.listFor(userId)).notifications.find(
        (n) => n.title === title,
      )
      return found!.id
    }
    return { service, repo, ada, bob, add }
  }

  it('lists only the caller own notifications, with the unread count', async () => {
    const { service, ada, bob, add } = await setup()
    const first = await add(ada, 'ada-1')
    await add(ada, 'ada-2')
    await add(bob, 'bob-1')
    const mine = await service.list(actorOf('learner', ada))
    expect(mine.notifications.map((n) => n.title).sort()).toEqual([
      'ada-1',
      'ada-2',
    ])
    expect(mine.unread).toBe(2)
    await service.markRead(actorOf('learner', ada), first)
    expect((await service.list(actorOf('learner', ada))).unread).toBe(1)
    expect((await service.list(actorOf('learner', bob))).unread).toBe(1)
  })

  it('refuses to read or mark someone else notification, admins included', async () => {
    const { service, repo, ada, bob, add } = await setup()
    const id = await add(ada, 'private')
    for (const actor of [
      actorOf('learner', bob),
      actorOf('teacher', bob),
      actorOf('admin', bob),
    ]) {
      await expect(service.markRead(actor, id)).rejects.toMatchObject({
        status: 404,
      })
    }
    expect((await repo.get(id))?.readAt).toBeNull()
    await expect(
      service.markRead(actorOf('learner', ada), uuidv7()),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      service.markRead(actorOf('learner', ada), 'not-a-uuid'),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('keeps the first read time when marked twice', async () => {
    const { service, repo, ada, add } = await setup()
    const id = await add(ada, 'once')
    const actor = actorOf('learner', ada)
    await service.markRead(actor, id, new Date('2030-01-01T00:00:00Z'))
    await service.markRead(actor, id, new Date('2030-02-02T00:00:00Z'))
    expect((await repo.get(id))?.readAt).toBe('2030-01-01T00:00:00.000Z')
  })
})
