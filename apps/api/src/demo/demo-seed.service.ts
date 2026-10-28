import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import { UsersRepository } from '../users/users.repository'
import { demoEnabled, processDemoEnv } from './policy'
import { seedClassroom } from './seed'

@Injectable()
export class DemoSeedService implements OnModuleInit {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(LessonsService) private readonly lessons: LessonsService,
  ) {}

  async onModuleInit() {
    if (!demoEnabled(processDemoEnv())) return
    await seedClassroom({
      users: this.users,
      groups: this.groups,
      lessons: this.lessons,
    })
  }
}
