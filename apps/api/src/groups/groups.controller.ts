import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import {
  SESSION_COOKIE,
  bearerSessionRejected,
  readCookie,
} from '../auth/policy'
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
  ) {
    const session = await this.requireSession(cookie, authorization)
    return { groups: this.groups.listForUser(session.userId) }
  }

  @Post()
  async create(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const session = await this.requireSession(cookie, authorization)
    const name =
      body &&
      typeof body === 'object' &&
      typeof (body as { name?: unknown }).name === 'string'
        ? (body as { name: string }).name
        : 'Group'
    return this.groups.create({
      name,
      actorId: session.userId,
      role: session.role,
    })
  }

  @Post(':groupId/members')
  async addMember(
    @Param('groupId') groupId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const session = await this.requireSession(cookie, authorization)
    const userId =
      body &&
      typeof body === 'object' &&
      typeof (body as { userId?: unknown }).userId === 'string'
        ? (body as { userId: string }).userId
        : ''
    return this.groups.addMember({ groupId, userId, role: session.role })
  }

  private async requireSession(
    cookie: string | undefined,
    authorization: string | undefined,
  ) {
    if (bearerSessionRejected(authorization)) {
      throw new HttpException({ error: 'cookie_session_required' }, 400)
    }
    const session = await this.auth.read(readCookie(cookie, SESSION_COOKIE))
    if (!session) throw new UnauthorizedException()
    return session
  }
}
