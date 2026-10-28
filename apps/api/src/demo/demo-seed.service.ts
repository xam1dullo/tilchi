import { Injectable, type OnModuleInit } from '@nestjs/common'
import { GroupsService } from '../groups/groups.service'
import { LessonsService } from '../lessons/lessons.service'
import { demoEnabled, processDemoEnv } from './policy'
import { seedClassroom } from './seed'

@Injectable()
export class DemoSeedService implements OnModuleInit {
  constructor(
    private readonly groups: GroupsService,
    private readonly lessons: LessonsService,
  ) {}

  onModuleInit() {
    if (!demoEnabled(processDemoEnv())) return
    seedClassroom({ groups: this.groups, lessons: this.lessons })
  }
}
