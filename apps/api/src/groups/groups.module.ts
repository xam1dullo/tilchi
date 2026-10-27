import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { GroupsController } from './groups.controller'
import { GroupsRepository } from './groups.repository'
import { GroupsService } from './groups.service'

@Module({
  imports: [AuthModule],
  controllers: [GroupsController],
  providers: [GroupsRepository, GroupsService],
  exports: [GroupsRepository],
})
export class GroupsModule {}
