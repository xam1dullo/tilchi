import { describe, expect, it } from 'vitest'
import { enterApp, type SessionUser } from './session'

const user: SessionUser = { userId: 'u-1', role: 'learner', name: 'Ali' }

describe('enterApp', () => {
  it('reads the session first, then reloads the route so the app shows', async () => {
    const order: string[] = []
    const router = {
      invalidate: async () => {
        order.push('invalidate')
      },
    }
    const entered = await enterApp(router, async () => {
      order.push('load')
      return user
    })
    expect(entered).toBe(true)
    expect(order).toEqual(['load', 'invalidate'])
  })

  it('stays put and reports false when the cookie gave no session', async () => {
    let reloads = 0
    const router = {
      invalidate: async () => {
        reloads += 1
      },
    }
    await expect(enterApp(router, async () => null)).resolves.toBe(false)
    expect(reloads).toBe(0)
  })
})
