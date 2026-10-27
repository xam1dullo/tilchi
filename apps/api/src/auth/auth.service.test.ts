import { HttpException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthService } from './auth.service'
import { HANDOFF_TTL_MS } from './policy'

function status(run: () => unknown) {
  try {
    run()
  } catch (error) {
    if (error instanceof HttpException) return error.getStatus()
    throw error
  }
  return 200
}

describe('AuthService handoff', () => {
  it('keeps a handoff pending until the bot approves it', () => {
    const auth = new AuthService()
    const { handoffId } = auth.start({ ip: '1.1.1.1', now: 0 })
    expect(status(() => auth.confirm(handoffId, 1))).toBe(409)
    auth.approve(handoffId, 'tg-1', 2)
    const opened = auth.confirm(handoffId, 3)
    expect(auth.read(opened.token, 4)?.role).toBe('learner')
  })

  it('opens at most one session per handoff', () => {
    const auth = new AuthService()
    const { handoffId } = auth.start({ ip: '1.1.1.1', now: 0 })
    auth.approve(handoffId, 'tg-1', 1)
    auth.confirm(handoffId, 2)
    expect(status(() => auth.confirm(handoffId, 3))).toBe(410)
  })

  it('refuses to approve an expired handoff', () => {
    const auth = new AuthService()
    const { handoffId } = auth.start({ ip: '1.1.1.1', now: 0 })
    expect(
      status(() => auth.approve(handoffId, 'tg-1', HANDOFF_TTL_MS + 1)),
    ).toBe(410)
  })
})
