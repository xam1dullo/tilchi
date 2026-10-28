import {
  Body,
  Controller,
  Headers,
  HttpException,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { confirmAnswer, confirmPrompt, expiredNotice } from './replies'
import { RegistrationService } from './registration.service'
import { type BotAction, parseBotUpdate } from './updates'
import { decideWebhook } from './webhook-guard'
import { Public } from '../http/actor'

@Public()
@Controller('bot')
export class BotController {
  constructor(
    private readonly auth: AuthService,
    private readonly registration: RegistrationService,
  ) {}

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
      const bound = await this.auth.bindTelegram(
        action.handoffId,
        action.telegramUserId,
        action.name,
      )
      return bound
        ? confirmPrompt({
            chatId: action.chatId,
            handoffId: action.handoffId,
            context: bound.context,
            lang: action.lang,
          })
        : expiredNotice(action.chatId, action.lang)
    }
    if (action.type === 'confirm_handoff') {
      const confirmed = await this.auth.confirmTelegram(
        action.handoffId,
        action.telegramUserId,
      )
      return confirmAnswer(action.callbackQueryId, confirmed)
    }
    const reply = await this.register(action)
    return reply ?? { ok: true, action: 'ignore' }
  }

  private register(action: BotAction) {
    switch (action.type) {
      case 'start_registration':
        return this.registration.start(action)
      case 'consent':
        return this.registration.consent(action)
      case 'answer':
        return this.registration.answer(action)
      case 'revoke_all':
        return this.registration.revokeAll(action)
      default:
        return null
    }
  }
}
