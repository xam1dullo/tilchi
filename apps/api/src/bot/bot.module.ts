import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { BotController } from './bot.controller'
import { BotService } from './bot.service'

@Module({
  imports: [AuthModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
