import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { BotService } from './bot.service'
import { decideWebhook, webhookProblem } from './webhook-guard'

@Controller('bot')
export class BotController {
  constructor(@Inject(BotService) private readonly bot: BotService) {
    const problem = webhookProblem({
      nodeEnv: process.env.NODE_ENV ?? '',
      secret: process.env.TELEGRAM_WEBHOOK_SECRET,
    })
    if (problem) {
      new Logger(BotController.name).warn(
        `${problem}: /bot/webhook refuses every update, so nobody can sign in`,
      )
    }
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Headers('x-telegram-bot-api-secret-token') header: string | undefined,
    @Body() body: unknown,
  ) {
    const decision = decideWebhook({
      nodeEnv: process.env.NODE_ENV ?? '',
      secret: process.env.TELEGRAM_WEBHOOK_SECRET,
      header,
    })
    if (decision === 'refuse_unset' || decision === 'refuse_weak') {
      throw new HttpException({ error: 'webhook_disabled' }, 503)
    }
    if (decision === 'bad_header') throw new UnauthorizedException()
    return this.bot.handle(body)
  }
}
