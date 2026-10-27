import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import type { SessionUser } from '../auth/auth.service'
import { CurrentUser, SessionGuard } from '../auth/session.guard'
import { LessonsService } from './lessons.service'

@Controller('api')
@UseGuards(SessionGuard)
export class LessonsController {
  constructor(
    @Inject(LessonsService) private readonly lessons: LessonsService,
  ) {}

  @Post('groups/:groupId/lessons')
  create(
    @CurrentUser() user: SessionUser,
    @Param('groupId') groupId: string,
    @Body() body: unknown,
  ) {
    return this.lessons.create(user, groupId, body)
  }

  @Get('groups/:groupId/lessons')
  list(@CurrentUser() user: SessionUser, @Param('groupId') groupId: string) {
    return this.lessons.listForGroup(user, groupId)
  }

  @Get('lessons/:id')
  get(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.lessons.get(user, id)
  }

  @Post('lessons/:id/start')
  @HttpCode(200)
  start(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.lessons.transition(user, id, 'start')
  }

  @Post('lessons/:id/end')
  @HttpCode(200)
  end(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.lessons.transition(user, id, 'end')
  }

  @Post('lessons/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.lessons.transition(user, id, 'cancel')
  }
}
