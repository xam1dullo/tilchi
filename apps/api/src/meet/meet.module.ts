import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { LessonsModule } from '../lessons/lessons.module'
import { MeetController } from './meet.controller'
import { MeetService } from './meet.service'

@Module({
  imports: [AuthModule, LessonsModule],
  controllers: [MeetController],
  providers: [MeetService],
})
export class MeetModule {}
