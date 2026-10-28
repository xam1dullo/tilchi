import { describe, expect, it } from 'vitest'
import { parseBotUpdate } from './updates'

describe('parseBotUpdate', () => {
  it('binds a /start handoff payload to the telegram user', () => {
    const action = parseBotUpdate({
      message: {
        text: '/start 01a17ecc6cf37882b3be7d39ce083092',
        from: { id: 99, first_name: 'Ada' },
      },
    })
    expect(action).toEqual({
      type: 'bind_handoff',
      handoffId: '01a17ecc-6cf3-7882-b3be-7d39ce083092',
      telegramUserId: '99',
      name: 'Ada',
    })
  })

  it('ignores unrelated updates', () => {
    expect(
      parseBotUpdate({ message: { text: 'hi', from: { id: 1 } } }),
    ).toEqual({
      type: 'ignore',
    })
  })
})
