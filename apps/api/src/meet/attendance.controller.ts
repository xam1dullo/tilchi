import { Controller, Get, Param } from '@nestjs/common'
import { Actor } from '../http/actor'
import { AttendanceService } from './attendance.service'

@Controller('api')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('lessons/:lessonId/attendance')
  forLesson(@Param('lessonId') lessonId: string, @Actor() actor: Actor) {
    return this.attendance.forLesson(actor, lessonId)
  }

  @Get('groups/:groupId/attendance')
  forGroup(@Param('groupId') groupId: string, @Actor() actor: Actor) {
    return this.attendance.forGroup(actor, groupId)
  }
}
