import {
  Controller,
  Get,
  Headers,
  HttpException,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { botUsername, loginDeepLink } from '../bot/login-link'
import { AuthService } from './auth.service'
import {
  HANDOFF_COOKIE,
  SESSION_COOKIE,
  bearerSessionRejected,
  clearCookieHeader,
  cookieHeader,
  readCookie,
} from './policy'

function refuseBearer(authorization: string | undefined) {
  if (bearerSessionRejected(authorization)) {
    throw new HttpException({ error: 'cookie_session_required' }, 400)
  }
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {
    // A bad TELEGRAM_BOT_USERNAME stops the boot instead of the first sign-in.
    botUsername(process.env)
  }

  // req.ip honours `trust proxy` 1: nginx's $remote_addr, never a client-sent X-Forwarded-For.
  @Post('start')
  start(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const started = this.auth.start({
      ip: req.ip ?? 'unknown',
      userAgent: req.get('user-agent'),
    })
    res.setHeader(
      'Set-Cookie',
      cookieHeader(started.claim, started.expiresInSeconds, HANDOFF_COOKIE),
    )
    return {
      handoffId: started.handoffId,
      deepLink: loginDeepLink(started.handoffId),
      expiresInSeconds: started.expiresInSeconds,
    }
  }

  @Post('claim')
  claim(
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = this.auth.claim(readCookie(cookie, HANDOFF_COOKIE))
    if (result.status === 'expired') {
      throw new HttpException({ error: 'handoff_expired' }, 410)
    }
    if (result.status === 'waiting') {
      res.status(202)
      return { status: 'waiting' }
    }
    res.setHeader('Set-Cookie', [
      cookieHeader(result.token, result.maxAgeSeconds),
      clearCookieHeader(HANDOFF_COOKIE),
    ])
    return { status: 'confirmed' }
  }

  @Get('session')
  session(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    refuseBearer(authorization)
    return { user: this.auth.read(readCookie(cookie, SESSION_COOKIE)) }
  }

  @Post('logout')
  logout(
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.auth.logout(readCookie(cookie, SESSION_COOKIE))
    res.setHeader('Set-Cookie', clearCookieHeader())
    return { ok: true }
  }
}
