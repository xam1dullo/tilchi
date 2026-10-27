import {
  Controller,
  Headers,
  HttpException,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { decideWebhook } from './webhook-guard'

@Controller('bot')
export class BotController {
  @Post('webhook')
  webhook(
    @Headers('x-telegram-bot-api-secret-token') header: string | undefined,
  ) {
    const decision = decideWebhook({
      nodeEnv: process.env.NODE_ENV ?? '',
      secret: process.env.TELEGRAM_WEBHOOK_SECRET,
      header,
    })
    if (decision === 'refuse_unset')
      throw new HttpException({ error: 'webhook_disabled' }, 503)
    if (decision === 'bad_header') throw new UnauthorizedException()
    return { ok: true }
  }
}
