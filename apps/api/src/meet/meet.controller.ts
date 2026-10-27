import {
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
import { issueMeetTicket } from './ticket'

@Controller('api/meet')
export class MeetController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('ticket')
  ticket(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    if (bearerSessionRejected(authorization)) {
      throw new HttpException({ error: 'cookie_session_required' }, 400)
    }
    const token = readCookie(cookie, SESSION_COOKIE)
    const session = this.auth.read(token)
    if (!session || !token) throw new UnauthorizedException()
    return issueMeetTicket({ sessionToken: token })
  }
}
