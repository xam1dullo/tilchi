import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common'
import type { SessionUser } from '../auth/auth.service'
import { CurrentUser, SessionGuard } from '../auth/session.guard'
import { MeetService } from './meet.service'

@Controller('api/meet')
@UseGuards(SessionGuard)
export class MeetController {
  constructor(@Inject(MeetService) private readonly meet: MeetService) {}

  @Post('token')
  @HttpCode(200)
  token(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return this.meet.mint(user, body)
  }
}
