import { describe, expect, it } from 'vitest'
import { statusTone } from './tone'

describe('statusTone', () => {
  it('marks only a graded attempt with the brand colour', () => {
    expect(statusTone('graded')).toBe('mark')
  })

  it('warns on a missed attempt or a cancelled lesson', () => {
    expect(statusTone('missed')).toBe('warn')
    expect(statusTone('cancelled')).toBe('warn')
  })

  it('keeps routine states neutral', () => {
    for (const s of ['assigned', 'submitted', 'scheduled', 'ended'] as const) {
      expect(statusTone(s)).toBeUndefined()
    }
  })
})
