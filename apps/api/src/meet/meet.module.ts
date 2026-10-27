import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MeetController } from './meet.controller'

@Module({ imports: [AuthModule], controllers: [MeetController] })
export class MeetModule {}
