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
import { requireActor } from '../http/actor'
import { canSeeGroup } from './access'
import { GroupsService } from './groups.service'

@Controller('api/groups')
export class GroupsController {
  constructor(
    private readonly auth: AuthService,
    private readonly groups: GroupsService,
  ) {}

  @Get()
  async list(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    const actor = await this.actor(cookie, authorization, previewRole)
    return { groups: await this.groups.listForUser(actor.userId, actor.role) }
  }

  @Post()
  async create(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(cookie, authorization, previewRole)
    const name =
      body &&
      typeof body === 'object' &&
      typeof (body as { name?: unknown }).name === 'string'
        ? (body as { name: string }).name
        : 'Group'
    return this.groups.create({
      name,
      actorId: actor.userId,
      role: actor.role,
    })
  }

  @Get(':groupId')
  async get(
    @Param('groupId') groupId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    const actor = await this.actor(cookie, authorization, previewRole)
    const group = await this.groups.get(groupId)
    if (!group || !canSeeGroup(actor, group)) {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    return group
  }

  @Post(':groupId/members')
  async addMember(
    @Param('groupId') groupId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
    @Body() body: unknown,
  ) {
    const actor = await this.actor(cookie, authorization, previewRole)
    const userId =
      body &&
      typeof body === 'object' &&
      typeof (body as { userId?: unknown }).userId === 'string'
        ? (body as { userId: string }).userId
        : ''
    return this.groups.addMember({ groupId, userId, role: actor.role })
  }

  private actor(
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
}
