import { Module } from '@nestjs/common'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { BotController } from './bot/bot.controller'
import { Database } from './db/database'
import { DemoController } from './demo/demo.controller'
import { DemoSeedService } from './demo/demo-seed.service'
import { GroupsController } from './groups/groups.controller'
import { GroupsService } from './groups/groups.service'
import { GroupsRepository } from './groups/groups.repository'
import { HealthController } from './health/health.controller'
import { LessonsController } from './lessons/lessons.controller'
import { LessonEvents } from './lessons/lesson-events'
import { LessonsService } from './lessons/lessons.service'
import { LessonsRepository } from './lessons/lessons.repository'
import { MeetController } from './meet/meet.controller'
import { MeetService } from './meet/meet.service'
import { RoomAdmin } from './meet/room-admin'
import { KV, createKvFromEnv } from './redis/kv'
import { SessionsRepository } from './users/sessions.repository'
import { UsersRepository } from './users/users.repository'

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
    // Postgres is configured by DATABASE_URL; boot fails without it (not in tests).
    { provide: Database, useFactory: () => Database.open() },
    { provide: KV, useFactory: () => createKvFromEnv() },
    UsersRepository,
    SessionsRepository,
    AuthService,
    GroupsRepository,
    LessonsRepository,
    LessonEvents,
    GroupsService,
    LessonsService,
    MeetService,
    RoomAdmin,
    DemoSeedService,
  ],
})
export class AppModule {}
