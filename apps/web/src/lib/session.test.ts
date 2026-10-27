import { afterEach, describe, expect, it, vi } from 'vitest'
import { previewSession, readSession } from './session'

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

describe('readSession', () => {
  it('returns the signed-in user', async () => {
    const user = { userId: 'u1', role: 'teacher', name: 'Mukhtasar' }
    expect(await readSession(json({ user }))).toEqual(user)
  })

  it('returns null when the API says nobody is signed in', async () => {
    expect(await readSession(json({ user: null }))).toBeNull()
    expect(await readSession(json({}))).toBeNull()
  })

  it('fails, instead of signing the user out, when the API cannot answer', async () => {
    for (const status of [500, 502, 503, 429]) {
      await expect(readSession(json({ user: null }, status))).rejects.toThrow(
        `api_${status}`,
      )
    }
  })

  it('fails on a body that is not JSON', async () => {
    await expect(
      readSession(new Response('<html>', { status: 200 })),
    ).rejects.toThrow()
  })
})
