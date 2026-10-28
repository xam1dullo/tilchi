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
import { SESSION_COOKIE, readCookie } from '../auth/policy'
import { Actor } from '../http/actor'
import { MeetService } from './meet.service'
import { issueMeetTicket } from './ticket'

@Controller('api/meet')
export class MeetController {
  constructor(
    private readonly auth: AuthService,
    private readonly meet: MeetService,
  ) {}

  @Post('ticket')
  async ticket(@Headers('cookie') cookie: string | undefined) {
    // Session-only: the guard's demo/preview fallback must not mint a ticket.
    const token = readCookie(cookie, SESSION_COOKIE)
    if (!token || !(await this.auth.read(token))) {
      throw new UnauthorizedException()
    }
    return issueMeetTicket({ sessionToken: token })
  }

  @Post('lessons/:lessonId/token')
  livekitToken(@Param('lessonId') lessonId: string, @Actor() actor: Actor) {
    return this.meet.tokenForLesson({
      lessonId,
      actor,
      apiKey: process.env.LIVEKIT_API_KEY ?? '',
      apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
    })
  }

  @Post('lessons/:lessonId/participants/:userId/:action')
  @HttpCode(200)
  moderate(
    @Param('lessonId') lessonId: string,
    @Param('userId') userId: string,
    @Param('action') action: string,
    @Actor() actor: Actor,
  ) {
    if (action !== 'mute' && action !== 'remove') {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    return this.meet.moderate({
      lessonId,
      actor,
      targetUserId: userId,
      action,
    })
  }
}
