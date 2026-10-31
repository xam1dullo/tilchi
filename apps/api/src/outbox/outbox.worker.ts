import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { OutboxRepository } from './outbox.repository'
import { OutboxService } from './outbox.service'

const INTERVAL_MS = 5000
const BATCH = 20

/**
 * Drains the outbox on an interval. Several API instances may run it: rows are
 * claimed with `FOR UPDATE SKIP LOCKED`, so none is handled twice at once.
 * Off in tests and when `OUTBOX_DRAIN=off`; tests call `drainOnce` directly.
 */
@Injectable()
export class OutboxWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly log = new Logger(OutboxWorker.name)
  private timer: NodeJS.Timeout | undefined
  private running: Promise<unknown> | null = null

  constructor(
    @Inject(OutboxRepository) private readonly outbox: OutboxRepository,
    @Inject(OutboxService) private readonly service: OutboxService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test' || process.env.OUTBOX_DRAIN === 'off') {
      return
    }
    this.timer = setInterval(() => this.kick(), INTERVAL_MS)
    this.timer.unref()
  }

  async onApplicationShutdown() {
    clearInterval(this.timer)
    await this.running
  }

  /** Starts or joins a drain; resolves when it finishes and never rejects. */
  kick() {
    this.running ??= this.drainOnce()
      .catch((error: Error) => this.log.error(`drain: ${error.message}`))
      .finally(() => {
        this.running = null
      })
    return this.running
  }

  /**
   * Handles due rows, oldest first, up to one batch. Returns how many. Without
   * `now` each row reads the clock itself, so a long batch never works on a
   * stale time; tests pass a fixed `now`.
   */
  async drainOnce(now?: Date): Promise<number> {
    let handled = 0
    while (handled < BATCH && (await this.runOne(now))) {
      handled += 1
    }
    return handled
  }

  private runOne(fixed?: Date) {
    const now = fixed ?? new Date()
    return this.outbox.runNext(now, (row, tx) =>
      this.service.handle(row, now, tx),
    )
  }
}
