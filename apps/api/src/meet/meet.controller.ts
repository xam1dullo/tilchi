import {
  Body,
  Controller,
  Headers,
  HttpException,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import {
  SESSION_COOKIE,
  bearerSessionRejected,
  readCookie,
} from '../auth/policy'
import {
  MEET_TOKEN_TTL_SECONDS,
  livekitCredentials,
  mintLiveKitToken,
  parseRoom,
} from './livekit-token'

@Controller('api/meet')
export class MeetController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('token')
  token(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    if (bearerSessionRejected(authorization)) {
      throw new HttpException({ error: 'cookie_session_required' }, 400)
    }
    const session = this.auth.read(readCookie(cookie, SESSION_COOKIE))
    if (!session) throw new UnauthorizedException()
    const room = parseRoom(body)
    if (!room) throw new HttpException({ error: 'bad_room' }, 400)
    // ponytail: no Group membership check until the Group slice lands, so production refuses
    if (process.env.NODE_ENV === 'production') {
      throw new HttpException({ error: 'meet_not_ready' }, 503)
    }
    const credentials = livekitCredentials(process.env)
    if (!credentials) throw new HttpException({ error: 'meet_disabled' }, 503)
    return {
      token: mintLiveKitToken({ credentials, identity: session.userId, room }),
      expiresInSeconds: MEET_TOKEN_TTL_SECONDS,
    }
  }
}
