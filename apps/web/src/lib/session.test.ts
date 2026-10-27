import { afterEach, describe, expect, it, vi } from 'vitest'
import { previewSession } from './session'

describe('previewSession', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('gives a preview user for each role outside production', () => {
    for (const role of ['learner', 'teacher', 'admin'] as const) {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('TILCHI_PREVIEW_ROLE', role)
      expect(previewSession()).toEqual({
        userId: 'preview',
        role,
        name: 'Preview',
      })
    }
  })

  it('is off in production even when the role is set', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TILCHI_PREVIEW_ROLE', 'admin')
    expect(previewSession()).toBeNull()
  })

  it('is off when the role is unset, empty or not a real role', () => {
    vi.stubEnv('NODE_ENV', 'development')
    for (const value of ['', 'owner', 'ADMIN', 'parent']) {
      vi.stubEnv('TILCHI_PREVIEW_ROLE', value)
      expect(previewSession()).toBeNull()
    }
    vi.stubEnv('TILCHI_PREVIEW_ROLE', undefined)
    expect(previewSession()).toBeNull()
  })
})
