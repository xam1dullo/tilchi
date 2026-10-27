import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Post,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { AuthService } from './auth.service'
import {
  SESSION_COOKIE,
  bearerSessionRejected,
  clearCookieHeader,
  cookieHeader,
  readCookie,
} from './policy'

function clientIp(forwarded: string | undefined) {
  const first = forwarded?.split(',')[0]?.trim()
  return first || 'unknown'
}

function refuseBearer(authorization: string | undefined) {
  if (bearerSessionRejected(authorization)) {
    throw new HttpException({ error: 'cookie_session_required' }, 400)
  }
}

function telegramKey(body: unknown) {
  if (!body || typeof body !== 'object') return undefined
  const value = (body as { telegramKey?: unknown }).telegramKey
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 64) : undefined
}

function handoffId(body: unknown) {
  if (!body || typeof body !== 'object') return ''
  const value = (body as { handoffId?: unknown }).handoffId
  return typeof value === 'string' ? value : ''
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('start')
  start(
    @Headers('x-forwarded-for') forwarded: string | undefined,
    @Body() body: unknown,
  ) {
    return this.auth.start({
      ip: clientIp(forwarded),
      telegramKey: telegramKey(body),
    })
  }

  @Post('confirm')
  confirm(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const opened = this.auth.confirm(handoffId(body))
    res.setHeader(
      'Set-Cookie',
      cookieHeader(opened.token, opened.maxAgeSeconds),
    )
    return { ok: true }
  }

  @Get('session')
  session(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    refuseBearer(authorization)
    const session = this.auth.read(readCookie(cookie, SESSION_COOKIE))
    if (!session) return { user: null }
    return { user: session }
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
