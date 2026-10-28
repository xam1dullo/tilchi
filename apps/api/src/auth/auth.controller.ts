import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { clientIp } from './client-ip'
import {
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
  async start(
    @Req() req: Request,
    @Headers('x-real-ip') realIp: string | undefined,
    @Body() body: unknown,
  ) {
    return this.auth.start({
      ip: clientIp({ realIp, requestIp: req.ip }),
      telegramKey: telegramKey(body),
    })
  }

  @Post('confirm')
  async confirm(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const opened = await this.auth.confirm(handoffId(body))
    res.setHeader(
      'Set-Cookie',
      cookieHeader(opened.token, opened.maxAgeSeconds),
    )
    return { ok: true, user: { id: opened.user.id, role: opened.user.role } }
  }

  @Get('session')
  async session(
    @Headers('cookie') cookie: string | undefined,
    @Headers('authorization') authorization: string | undefined,
  ) {
    refuseBearer(authorization)
    const session = await this.auth.read(readCookie(cookie, SESSION_COOKIE))
    if (!session) return { user: null }
    return { user: session }
  }

  @Post('logout')
  async logout(
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(readCookie(cookie, SESSION_COOKIE))
    res.setHeader('Set-Cookie', clearCookieHeader())
    return { ok: true }
  }
}
