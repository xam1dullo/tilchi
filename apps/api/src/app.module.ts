import { Module } from '@nestjs/common'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { BotController } from './bot/bot.controller'
import { HealthController } from './health/health.controller'
import { MeetController } from './meet/meet.controller'

@Module({
  controllers: [
    HealthController,
    AuthController,
    BotController,
    MeetController,
  ],
  providers: [AuthService],
})
export class AppModule {}
