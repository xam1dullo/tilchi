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
  HANDOFF_COOKIE,
  HANDOFF_TTL_MS,
  SESSION_COOKIE,
  bearerSessionRejected,
  clearCookieHeader,
  clearHandoffCookieHeader,
  confirmAvailable,
  cookieHeader,
  handoffCookieHeader,
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

function field(body: unknown, name: string) {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : ''
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('start')
  async start(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-real-ip') realIp: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Body() body: unknown,
  ) {
    const ip = clientIp({ realIp, requestIp: req.ip })
    const started = await this.auth.start({
      ip,
      context: `${ip} / ${(userAgent ?? 'unknown').slice(0, 80)}`,
      telegramKey: telegramKey(body),
    })
    res.setHeader(
      'Set-Cookie',
      handoffCookieHeader(started.bindingSecret, HANDOFF_TTL_MS / 1000),
    )
    return {
      handoffId: started.handoffId,
      deepLink: started.deepLink,
      expiresInSeconds: started.expiresInSeconds,
    }
  }

  @Post('confirm')
  async confirm(
    @Headers('cookie') cookie: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const available = confirmAvailable({
      nodeEnv: process.env.NODE_ENV ?? 'development',
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    })
    if (!available) {
      throw new HttpException({ error: 'telegram_confirm_unavailable' }, 503)
    }
    const opened = await this.auth.confirm(
      field(body, 'handoffId'),
      readCookie(cookie, HANDOFF_COOKIE),
    )
    res.setHeader('Set-Cookie', [
      cookieHeader(opened.token, opened.maxAgeSeconds),
      clearHandoffCookieHeader(),
    ])
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
