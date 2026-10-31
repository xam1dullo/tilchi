import { expect, it, vi } from 'vitest'
import type { OutboxRepository } from './outbox.repository'
import type { OutboxService } from './outbox.service'
import { OutboxWorker } from './outbox.worker'

it('lets callers await a kicked drain and shutdown waits for the same work', async () => {
  let release = () => {}
  const gate = new Promise<boolean>((resolve) => {
    release = () => resolve(false)
  })
  const runNext = vi.fn(() => gate)
  const worker = new OutboxWorker(
    { runNext } as unknown as OutboxRepository,
    {} as OutboxService,
  )
  const running = worker.kick()
  try {
    expect(running).toBeInstanceOf(Promise)
    expect(worker.kick()).toBe(running)
    let stopped = false
    const shutdown = worker.onApplicationShutdown().then(() => {
      stopped = true
    })
    await Promise.resolve()
    expect(stopped).toBe(false)
    release()
    await running
    await shutdown
    expect(stopped).toBe(true)
    expect(runNext).toHaveBeenCalledTimes(1)
  } finally {
    release()
    await worker.onApplicationShutdown()
  }
})
