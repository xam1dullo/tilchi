import { type DynamicModule, Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { BotModule } from './bot/bot.module'
import type { Db } from './db/client'
import { DbModule } from './db/db.module'
import { GroupsModule } from './groups/groups.module'
import { HealthController } from './health/health.controller'
import { MeetModule } from './meet/meet.module'
import { UsersModule } from './users/users.module'

@Module({ controllers: [HealthController] })
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules are classes with a static factory
export class AppModule {
  // `db` lets tests run on an in-process database; production passes nothing
  // and connects with DATABASE_URL.
  static register(db?: Db): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DbModule.forRoot(db),
        UsersModule,
        AuthModule,
        BotModule,
        GroupsModule,
        MeetModule,
      ],
    }
  }
}
