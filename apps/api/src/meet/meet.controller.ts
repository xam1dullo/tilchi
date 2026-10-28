import {
  Controller,
  Headers,
  HttpCode,
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
import { PREVIEW_HEADER } from '../demo/policy'
import { requireActor } from '../http/actor'
import { MeetService } from './meet.service'
import { issueMeetTicket } from './ticket'

@Controller('api/meet')
export class MeetController {
  constructor(
    private readonly auth: AuthService,
    private readonly meet: MeetService,
  ) {}

  @Post('ticket')
  async ticket(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    const session = await this.requireSession(cookie, authorization)
    void session
    const token = readCookie(cookie, SESSION_COOKIE)
    if (!token) throw new UnauthorizedException()
    return issueMeetTicket({ sessionToken: token })
  }

  @Post('lessons/:lessonId/token')
  async livekitToken(
    @Param('lessonId') lessonId: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    const actor = await requireActor({
      auth: this.auth,
      cookie,
      authorization,
      previewRole,
    })
    return this.meet.tokenForLesson({
      lessonId,
      actor,
      apiKey: process.env.LIVEKIT_API_KEY ?? '',
      apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
    })
  }

  @Post('lessons/:lessonId/participants/:userId/:action')
  @HttpCode(200)
  async moderate(
    @Param('lessonId') lessonId: string,
    @Param('userId') userId: string,
    @Param('action') action: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Headers(PREVIEW_HEADER) previewRole: string | undefined,
  ) {
    if (action !== 'mute' && action !== 'remove') {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    const actor = await requireActor({
      auth: this.auth,
      cookie,
      authorization,
      previewRole,
    })
    return this.meet.moderate({
      lessonId,
      actor,
      targetUserId: userId,
      action,
    })
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
