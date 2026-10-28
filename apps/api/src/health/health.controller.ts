import { Controller, Get } from '@nestjs/common'
import { Public } from '../http/actor'

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
}
