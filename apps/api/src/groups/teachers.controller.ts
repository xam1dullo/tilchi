import { Controller, Get } from '@nestjs/common'
import { authorize } from '../authz/policy'
import { Actor } from '../http/actor'
import { UsersRepository } from '../users/users.repository'

@Controller('api/teachers')
export class TeachersController {
  constructor(private readonly users: UsersRepository) {}

  /** For the admin's group form: no phone, no Telegram id. */
  @Get()
  async list(@Actor() actor: Actor) {
    authorize(actor, 'teacher.list')
    return { teachers: await this.users.listTeachers() }
  }
}
