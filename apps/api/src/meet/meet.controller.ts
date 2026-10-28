import {
  Controller,
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
import { issueMeetTicket } from './ticket'

@Controller('api/meet')
export class MeetController {
  constructor(private readonly auth: AuthService) {}

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
  ) {
    await this.requireSession(cookie, authorization)
    void lessonId
    throw new HttpException(
      {
        error: 'meet_ticket_not_ready',
        note: 'LiveKit mint waits on a signed, room-scoped, single-use ticket',
      },
      501,
    )
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
