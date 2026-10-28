import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common'
import { groupView, lessonView } from '../authz/views'
import { GroupsService } from '../groups/groups.service'
import { Actor } from '../http/actor'
import { RoomAdmin } from '../meet/room-admin'
import { OutboxRepository } from '../outbox/outbox.repository'
import { OutboxWorker } from '../outbox/outbox.worker'
import { LessonsService } from './lessons.service'

function scheduledAtOf(body: unknown) {
  const value = (body as { scheduledAt?: unknown } | null)?.scheduledAt
  return typeof value === 'string' ? value : ''
}

@Controller('api')
export class LessonsController {
  private readonly log = new Logger(LessonsController.name)

  constructor(
    private readonly groups: GroupsService,
    private readonly lessons: LessonsService,
    private readonly rooms: RoomAdmin,
    private readonly outbox: OutboxRepository,
    private readonly worker: OutboxWorker,
  ) {}

  @Get('groups/:groupId/lessons')
  async list(@Param('groupId') groupId: string, @Actor() actor: Actor) {
    const group = await this.groups.visible(actor, groupId)
    const lessons = await this.lessons.listForGroup(groupId)
    return {
      lessons: lessons.map((lesson) => lessonView(actor, group, lesson)),
    }
  }

  @Post('groups/:groupId/lessons')
  async create(
    @Param('groupId') groupId: string,
    @Actor() actor: Actor,
    @Body() body: unknown,
  ) {
    return this.lessons.create({
      groupId,
      scheduledAt: scheduledAtOf(body),
      actor,
    })
  }

  @Get('lessons/:lessonId')
  async get(@Param('lessonId') lessonId: string, @Actor() actor: Actor) {
    const { lesson, group } = await this.lessons.visible(actor, lessonId)
    return {
      lesson: lessonView(actor, group, lesson),
      group: groupView(actor, group),
      meeting: await this.lessons.meetingForLesson(lesson.id),
    }
  }

  @Post('lessons/:lessonId/start')
  start(@Param('lessonId') lessonId: string, @Actor() actor: Actor) {
    return this.lessons.start({ lessonId, actor })
  }

  @Post('lessons/:lessonId/end')
  async end(@Param('lessonId') lessonId: string, @Actor() actor: Actor) {
    const ended = await this.lessons.end({ lessonId, actor })
    const meeting = await this.lessons.meetingForLesson(lessonId)
    if (meeting) await this.closeRoom(lessonId, meeting.livekitRoom)
    return ended
  }

  /**
   * Participants must be removed as the request ends. If LiveKit fails, the
   * lesson is already ended; the `meeting.close` outbox row (queued with the
   * End) retries the close, so the failure is not an error for the teacher.
   */
  private readonly closeRoom = async (lessonId: string, room: string) => {
    try {
      await this.rooms.close(room)
      await this.outbox.complete(`meeting.close:${lessonId}`)
    } catch (error) {
      this.log.error(`close ${room}: ${(error as Error).message}; will retry`)
      this.worker.kick()
    }
  }

  @Post('lessons/:lessonId/cancel')
  cancel(@Param('lessonId') lessonId: string, @Actor() actor: Actor) {
    return this.lessons.cancel({ lessonId, actor })
  }

  @Post('lessons/:lessonId/reschedule')
  reschedule(
    @Param('lessonId') lessonId: string,
    @Actor() actor: Actor,
    @Body() body: unknown,
  ) {
    return this.lessons.reschedule({
      lessonId,
      scheduledAt: scheduledAtOf(body),
      actor,
    })
  }
}
