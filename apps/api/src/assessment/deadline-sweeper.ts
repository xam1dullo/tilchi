import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { AssessmentService } from './assessment.service'

const INTERVAL_MS = 60_000

/**
 * Turns attempts past their deadline into `missed` once a minute. The update is
 * one idempotent statement, so several API instances may run it. Off in tests
 * and when `OUTBOX_DRAIN=off`; tests call `sweepOnce` directly.
 */
@Injectable()
export class DeadlineSweeper
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly log = new Logger(DeadlineSweeper.name)
  private timer: NodeJS.Timeout | undefined

  constructor(
    @Inject(AssessmentService) private readonly service: AssessmentService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test' || process.env.OUTBOX_DRAIN === 'off') {
      return
    }
    this.timer = setInterval(() => {
      this.sweepOnce().catch((error: Error) =>
        this.log.error(`sweep: ${error.message}`),
      )
    }, INTERVAL_MS)
    this.timer.unref()
  }

  onApplicationShutdown() {
    clearInterval(this.timer)
  }

  sweepOnce(now = new Date()) {
    return this.service.sweep(now)
  }
}
