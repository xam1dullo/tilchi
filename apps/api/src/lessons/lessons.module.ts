import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { GroupsModule } from '../groups/groups.module'
import { LessonsController } from './lessons.controller'
import { LessonsRepository } from './lessons.repository'
import { LessonsService } from './lessons.service'

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [LessonsController],
  providers: [LessonsRepository, LessonsService],
  exports: [LessonsRepository],
})
export class LessonsModule {}
