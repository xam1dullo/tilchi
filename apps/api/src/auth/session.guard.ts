import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common'
import type { Request } from 'express'
import { AuthService, type SessionUser } from './auth.service'
import { SESSION_COOKIE, bearerSessionRejected, readCookie } from './policy'

type WithUser = Pick<Request, 'headers'> & { user?: SessionUser }

// Cookie session only. A bearer header is refused outright so no client ever
// has a reason to keep the session token in script-readable storage.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<WithUser>()
    if (bearerSessionRejected(request.headers.authorization)) {
      throw new HttpException({ error: 'cookie_session_required' }, 400)
    }
    const user = this.auth.read(
      readCookie(request.headers.cookie, SESSION_COOKIE),
    )
    if (!user) throw new UnauthorizedException()
    request.user = user
    return true
  }
}

// The signed-in user; only valid on routes behind SessionGuard.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser =>
    context.switchToHttp().getRequest<WithUser>().user as SessionUser,
)
