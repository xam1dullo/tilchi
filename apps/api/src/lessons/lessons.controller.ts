import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { groupView, lessonView } from '../authz/views'
import { GroupsService } from '../groups/groups.service'
import { Actor } from '../http/actor'
import { OutboxWorker } from '../outbox/outbox.worker'
import { LessonsService } from './lessons.service'

function scheduledAtOf(body: unknown) {
  const value = (body as { scheduledAt?: unknown } | null)?.scheduledAt
  return typeof value === 'string' ? value : ''
}

@Controller('api')
export class LessonsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly lessons: LessonsService,
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
    // The room closes from the outbox (retried on failure); drain it now.
    this.worker.kick()
    return ended
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
