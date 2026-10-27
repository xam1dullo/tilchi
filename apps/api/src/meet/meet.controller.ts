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
import { LessonsService } from '../lessons/lessons.service'
import { mintLivekitToken } from './livekit'
import { issueMeetTicket } from './ticket'

@Controller('api/meet')
export class MeetController {
  constructor(
    private readonly auth: AuthService,
    private readonly lessons: LessonsService,
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
  ) {
    const session = await this.requireSession(cookie, authorization)
    const lesson = this.lessons.get(lessonId)
    if (!lesson) throw new HttpException({ error: 'not_found' }, 404)
    if (lesson.status !== 'live')
      throw new HttpException({ error: 'meeting_closed' }, 409)
    const meeting = this.lessons.meetingForLesson(lessonId)
    if (!meeting) throw new HttpException({ error: 'meeting_missing' }, 409)
    const cookieToken = readCookie(cookie, SESSION_COOKIE) ?? ''
    const minted = await mintLivekitToken({
      apiKey: process.env.LIVEKIT_API_KEY ?? '',
      apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
      claims: {
        room: meeting.livekitRoom,
        identity: session.userId,
        name: session.name ?? session.userId,
        canPublish: session.role === 'teacher' || session.role === 'admin',
      },
    })
    if (minted.token.includes(cookieToken) && cookieToken.length > 8) {
      throw new HttpException({ error: 'session_leak' }, 500)
    }
    return minted
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
