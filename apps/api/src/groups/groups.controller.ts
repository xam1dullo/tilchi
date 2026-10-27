import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import type { SessionUser } from '../auth/auth.service'
import { CurrentUser, SessionGuard } from '../auth/session.guard'
import { GroupsService } from './groups.service'

@Controller('api/groups')
@UseGuards(SessionGuard)
export class GroupsController {
  constructor(@Inject(GroupsService) private readonly groups: GroupsService) {}

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return this.groups.create(user, body)
  }

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.groups.list(user)
  }

  @Get(':id')
  get(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.groups.get(user, id)
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.groups.addMember(user, id, body)
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.groups.removeMember(user, id, userId)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.groups.remove(user, id)
  }
}
