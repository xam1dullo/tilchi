import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
} from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { PREVIEW_HEADER } from '../demo/policy'
import { canManageGroup, canSeeGroup } from '../groups/access'
import { GroupsService } from '../groups/groups.service'
import { requireActor } from '../http/actor'
import { RoomAdmin } from '../meet/room-admin'
import { LessonsService } from './lessons.service'

function scheduledAtOf(body: unknown) {
  const value = (body as { scheduledAt?: unknown } | null)?.scheduledAt
  return typeof value === 'string' ? value : ''
}

@Controller('api')
export class LessonsController {
  constructor(
    private readonly auth: AuthService,
    private readonly groups: GroupsService,
    private readonly lessons: LessonsService,
    private readonly rooms: RoomAdmin,
  ) {}

  @Get('groups/:groupId/lessons')
  async list(
    @Param('groupId') groupId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    await this.visibleGroup(groupId, cookie, authorization, previewRole)
    return { lessons: await this.lessons.listForGroup(groupId) }
  }

  @Post('groups/:groupId/lessons')
  async create(
    @Param('groupId') groupId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
    @Body() body: unknown,
  ) {
    const actor = await this.managedGroup(
      groupId,
      cookie,
      authorization,
      previewRole,
    )
    const scheduledAt = scheduledAtOf(body)
    return this.lessons.create({
      groupId,
      scheduledAt,
      role: actor.role,
    })
  }

  @Get('lessons/:lessonId')
  async get(
    @Param('lessonId') lessonId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    const lesson = await this.lessons.get(lessonId)
    if (!lesson) throw new HttpException({ error: 'not_found' }, 404)
    const group = await this.visibleGroup(
      lesson.groupId,
      cookie,
      authorization,
      previewRole,
    )
    return {
      lesson,
      group,
      meeting: await this.lessons.meetingForLesson(lesson.id),
    }
  }

  @Post('lessons/:lessonId/start')
  async start(
    @Param('lessonId') lessonId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    const { actor } = await this.managedLesson(
      lessonId,
      cookie,
      authorization,
      previewRole,
    )
    return this.lessons.start({ lessonId, role: actor.role })
  }

  @Post('lessons/:lessonId/end')
  async end(
    @Param('lessonId') lessonId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    const { actor } = await this.managedLesson(
      lessonId,
      cookie,
      authorization,
      previewRole,
    )
    const ended = await this.lessons.end({ lessonId, role: actor.role })
    const meeting = await this.lessons.meetingForLesson(lessonId)
    if (meeting) await this.rooms.close(meeting.livekitRoom)
    return ended
  }

  @Post('lessons/:lessonId/cancel')
  async cancel(
    @Param('lessonId') lessonId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    const { actor } = await this.managedLesson(
      lessonId,
      cookie,
      authorization,
      previewRole,
    )
    return this.lessons.cancel({ lessonId, role: actor.role })
  }

  @Post('lessons/:lessonId/reschedule')
  async reschedule(
    @Param('lessonId') lessonId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
    @Body() body: unknown,
  ) {
    const { actor } = await this.managedLesson(
      lessonId,
      cookie,
      authorization,
      previewRole,
    )
    const scheduledAt = scheduledAtOf(body)
    return this.lessons.reschedule({ lessonId, scheduledAt, role: actor.role })
  }

  private async managedLesson(
    lessonId: string,
    cookie: string | undefined,
    authorization: string | undefined,
    previewRole: string | undefined,
  ) {
    const lesson = await this.lessons.get(lessonId)
    if (!lesson) throw new HttpException({ error: 'not_found' }, 404)
    const actor = await this.managedGroup(
      lesson.groupId,
      cookie,
      authorization,
      previewRole,
    )
    return { lesson, actor }
  }

  private async actor(
    cookie: string | undefined,
    authorization: string | undefined,
    previewRole: string | undefined,
  ) {
    return requireActor({
      auth: this.auth,
      cookie,
      authorization,
      previewRole,
    })
  }

  private async visibleGroup(
    groupId: string,
    cookie: string | undefined,
    authorization: string | undefined,
    previewRole: string | undefined,
  ) {
    const actor = await this.actor(cookie, authorization, previewRole)
    const group = await this.groups.get(groupId)
    if (!group || !canSeeGroup(actor, group)) {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    return group
  }

  private async managedGroup(
    groupId: string,
    cookie: string | undefined,
    authorization: string | undefined,
    previewRole: string | undefined,
  ) {
    const actor = await this.actor(cookie, authorization, previewRole)
    const group = await this.groups.get(groupId)
    if (!group || !canSeeGroup(actor, group)) {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    if (!canManageGroup(actor, group)) {
      throw new HttpException({ error: 'forbidden' }, 403)
    }
    return actor
  }
}
