import { Inject, Injectable } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import {
  confirmResultReply,
  linkExpiredReply,
  loginPromptReply,
  welcomeReply,
} from './replies'
import { parseBotUpdate } from './updates'

@Injectable()
export class BotService {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // Returns the webhook response body. A thrown error becomes a 5xx, so
  // Telegram redelivers the update while the handoff is still open.
  async handle(body: unknown, now = Date.now()) {
    const action = parseBotUpdate(body)
    switch (action.kind) {
      case 'welcome':
        return welcomeReply(action.chatId, action.language)
      case 'login_prompt': {
        const context = this.auth.preview(action.handoffId, now)
        return context
          ? loginPromptReply({ ...action, context })
          : linkExpiredReply(action.chatId, action.language)
      }
      case 'login_confirm': {
        const ok = await this.auth.confirm(
          action.handoffId,
          action.account,
          now,
        )
        return confirmResultReply({ ok, ...action })
      }
      default:
        return { ok: true }
    }
  }
}
