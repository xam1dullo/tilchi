import { Module } from '@nestjs/common'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { BotController } from './bot/bot.controller'
import { DemoController } from './demo/demo.controller'
import { DemoSeedService } from './demo/demo-seed.service'
import { GroupsController } from './groups/groups.controller'
import { GroupsService } from './groups/groups.service'
import { HealthController } from './health/health.controller'
import { LessonsController } from './lessons/lessons.controller'
import { LessonsService } from './lessons/lessons.service'
import { MeetController } from './meet/meet.controller'
import { MeetService } from './meet/meet.service'

@Module({
  controllers: [
    HealthController,
    AuthController,
    BotController,
    DemoController,
    GroupsController,
    LessonsController,
    MeetController,
  ],
  providers: [
    AuthService,
    GroupsService,
    LessonsService,
    MeetService,
    DemoSeedService,
  ],
})
export class AppModule {}
