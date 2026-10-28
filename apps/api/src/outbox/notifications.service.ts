import { HttpException, Inject, Injectable } from '@nestjs/common'
import { type Actor, authorizeNotification } from '../authz/policy'
import { NotificationsRepository } from './notifications.repository'

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository)
    private readonly notifications: NotificationsRepository,
  ) {}

  list(actor: Actor) {
    return this.notifications.listFor(actor.userId)
  }

  /** Marks one of the actor's own notifications read; anyone else's is a 404. */
  async markRead(actor: Actor, id: string, now = new Date()) {
    const found = await this.notifications.get(id)
    if (!found) throw new HttpException({ error: 'not_found' }, 404)
    authorizeNotification(actor, found)
    await this.notifications.markRead(id, actor.userId, now)
    return { ok: true }
  }
}
