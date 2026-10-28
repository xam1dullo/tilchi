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
import { LessonsService } from './lessons.service'

@Controller('api')
export class LessonsController {
  constructor(
    private readonly auth: AuthService,
    private readonly lessons: LessonsService,
  ) {}

  @Get('groups/:groupId/lessons')
  async list(
    @Param('groupId') groupId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.requireSession(cookie, authorization)
    return { lessons: this.lessons.listForGroup(groupId) }
  }

  @Post('groups/:groupId/lessons')
  async create(
    @Param('groupId') groupId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const session = await this.requireSession(cookie, authorization)
    const scheduledAt =
      body &&
      typeof body === 'object' &&
      typeof (body as { scheduledAt?: unknown }).scheduledAt === 'string'
        ? (body as { scheduledAt: string }).scheduledAt
        : ''
    return this.lessons.create({ groupId, scheduledAt, role: session.role })
  }

  @Post('lessons/:lessonId/start')
  async start(
    @Param('lessonId') lessonId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const session = await this.requireSession(cookie, authorization)
    return this.lessons.start({ lessonId, role: session.role })
  }

  @Post('lessons/:lessonId/end')
  async end(
    @Param('lessonId') lessonId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const session = await this.requireSession(cookie, authorization)
    return this.lessons.end({ lessonId, role: session.role })
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
