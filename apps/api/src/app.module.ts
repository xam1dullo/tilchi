import { Module } from '@nestjs/common'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { BotController } from './bot/bot.controller'
import { GroupsController } from './groups/groups.controller'
import { GroupsService } from './groups/groups.service'
import { HealthController } from './health/health.controller'
import { LessonsController } from './lessons/lessons.controller'
import { LessonsService } from './lessons/lessons.service'
import { MeetController } from './meet/meet.controller'

@Module({
  controllers: [
    HealthController,
    AuthController,
    BotController,
    GroupsController,
    LessonsController,
    MeetController,
  ],
  providers: [AuthService, GroupsService, LessonsService],
})
export class AppModule {}
