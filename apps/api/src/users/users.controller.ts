import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { authorize } from '../authz/policy'
import { Actor } from '../http/actor'
import { UsersRepository } from './users.repository'

@Controller('api/users')
export class UsersController {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  /** The admin's enrol search: learners by name, no contact details. */
  @Get()
  async search(@Actor() actor: Actor, @Query('q') q: unknown) {
    authorize(actor, 'user.search')
    return {
      users: typeof q === 'string' ? await this.users.searchLearners(q) : [],
    }
  }

  /** Records who gave a minor's guardian consent (PRD G7). */
  @Post(':userId/guardian-consent')
  async guardianConsent(
    @Param('userId') userId: string,
    @Actor() actor: Actor,
    @Body() body: unknown,
  ) {
    authorize(actor, 'user.recordConsent')
    const raw = (body as { by?: unknown } | null)?.by
    const by = typeof raw === 'string' ? raw.trim() : ''
    if (by.length === 0 || by.length > 120) {
      throw new HttpException({ error: 'invalid_guardian_consent' }, 400)
    }
    if (!(await this.users.recordGuardianConsent(userId, by))) {
      throw new HttpException({ error: 'user_not_found' }, 404)
    }
    return { ok: true }
  }
}
