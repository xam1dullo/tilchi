import { Controller, Get, HttpException } from '@nestjs/common'
import {
  DEMO_ADMIN,
  DEMO_LEARNER,
  DEMO_TEACHER,
  demoEnabled,
  parsePreviewRole,
  processDemoEnv,
} from './policy'

@Controller('api/demo')
export class DemoController {
  @Get('preview')
  preview() {
    const env = processDemoEnv()
    if (!demoEnabled(env)) {
      throw new HttpException({ error: 'not_found' }, 404)
    }
    return {
      enabled: true as const,
      role: parsePreviewRole(env.previewRole),
      users: {
        teacher: { role: DEMO_TEACHER.role, name: DEMO_TEACHER.name },
        learner: { role: DEMO_LEARNER.role, name: DEMO_LEARNER.name },
        admin: { role: DEMO_ADMIN.role, name: DEMO_ADMIN.name },
      },
    }
  }
}
