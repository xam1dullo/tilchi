import { Controller, Get, Param, Post } from '@nestjs/common'
import { Actor } from '../http/actor'
import { NotificationsService } from './notifications.service'

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** The caller's own inbox, newest first, with the unread count. */
  @Get()
  list(@Actor() actor: Actor) {
    return this.notifications.list(actor)
  }

  @Post(':id/read')
  read(@Param('id') id: string, @Actor() actor: Actor) {
    return this.notifications.markRead(actor, id)
  }
}
