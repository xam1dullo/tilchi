import { Controller, Get } from '@nestjs/common'
import { Public } from '../http/actor'
import { telegramBotUsername } from '../config'

export function healthBody() {
  return { ok: true as const, service: 'tilchi-api' }
}

@Public()
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return healthBody()
  }

  @Get('api/health')
  apiHealth() {
    return healthBody()
  }

  @Get('api/public-config')
  publicConfig() {
    return { telegramBotUsername: telegramBotUsername(process.env) }
  }
}
