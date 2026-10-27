import { Controller, Get } from '@nestjs/common'

export function healthBody() {
  return { ok: true as const, service: 'tilchi-api' }
}

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
