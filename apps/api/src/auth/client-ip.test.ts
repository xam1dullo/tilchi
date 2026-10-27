import { describe, expect, it } from 'vitest'
import { clientIp } from './client-ip'

describe('clientIp', () => {
  it('prefers nginx X-Real-IP and ignores client X-Forwarded-For', () => {
    expect(
      clientIp({
        realIp: '10.0.0.2',
        requestIp: '10.0.0.2',
        forwarded: '1.2.3.4, 10.0.0.2',
      }),
    ).toBe('10.0.0.2')
    expect(clientIp({ forwarded: '1.2.3.4' })).toBe('unknown')
  })
})
