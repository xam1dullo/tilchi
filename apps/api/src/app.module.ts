import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { BotApi } from './bot/bot-api'
import { BotController } from './bot/bot.controller'
import { RegistrationService } from './bot/registration.service'
import { CoursesController, CoursesService } from './courses/courses.controller'
import { ActorGuard } from './http/actor'
import { Database } from './db/database'
import { DemoController } from './demo/demo.controller'
import { DemoSeedService } from './demo/demo-seed.service'
import { GroupsController } from './groups/groups.controller'
import { TeachersController } from './groups/teachers.controller'
import { GroupsService } from './groups/groups.service'
import { GroupsRepository } from './groups/groups.repository'
import { HealthController } from './health/health.controller'
import { LessonsController } from './lessons/lessons.controller'
import { LessonsService } from './lessons/lessons.service'
import { LessonsRepository } from './lessons/lessons.repository'
import { AttendanceRepository } from './meet/attendance.repository'
import { LivekitWebhook } from './meet/livekit-webhook'
import { LivekitWebhookController } from './meet/livekit-webhook.controller'
import { MeetController } from './meet/meet.controller'
import { MeetService } from './meet/meet.service'
import { RoomAdmin } from './meet/room-admin'
import { NotificationsController } from './outbox/notifications.controller'
import { NotificationsRepository } from './outbox/notifications.repository'
import { NotificationsService } from './outbox/notifications.service'
import { OutboxRepository } from './outbox/outbox.repository'
import { OutboxService } from './outbox/outbox.service'
import { OutboxWorker } from './outbox/outbox.worker'
import { TelegramSender } from './outbox/telegram-sender'
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
    TeachersController,
    LessonsController,
    MeetController,
    LivekitWebhookController,
    NotificationsController,
    CoursesController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ActorGuard },
    // Postgres is configured by DATABASE_URL; boot fails without it (not in tests).
    { provide: Database, useFactory: () => Database.open() },
    { provide: KV, useFactory: () => createKvFromEnv() },
    UsersRepository,
    SessionsRepository,
    AuthService,
    BotApi,
    RegistrationService,
    GroupsRepository,
    LessonsRepository,
    GroupsService,
    LessonsService,
    MeetService,
    AttendanceRepository,
    LivekitWebhook,
    RoomAdmin,
    DemoSeedService,
    OutboxRepository,
    NotificationsRepository,
    NotificationsService,
    TelegramSender,
    OutboxService,
    OutboxWorker,
    CoursesService,
  ],
})
export class AppModule {}
