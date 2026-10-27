import {
  Body,
  Controller,
  Headers,
  HttpException,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { parseBotUpdate } from './updates'
import { decideWebhook } from './webhook-guard'

@Controller('bot')
export class BotController {
  constructor(private readonly auth: AuthService) {}

  @Post('webhook')
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') header: string | undefined,
    @Body() body: unknown,
  ) {
    const decision = decideWebhook({
      nodeEnv: process.env.NODE_ENV ?? 'development',
      secret: process.env.TELEGRAM_WEBHOOK_SECRET,
      header,
    })
    if (decision === 'refuse_unset') {
      throw new HttpException({ error: 'webhook_disabled' }, 503)
    }
    if (decision === 'bad_header') throw new UnauthorizedException()

    const action = parseBotUpdate(body)
    if (action.type === 'bind_handoff') {
      await this.auth.bindTelegram(
        action.handoffId,
        action.telegramUserId,
        action.name,
      )
      return { ok: true, action: 'bind_handoff' }
    }
    return { ok: true, action: 'ignore' }
  }
}
