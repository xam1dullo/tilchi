import { describe, expect, it } from 'vitest'
import { SESSION_COOKIE } from '../auth/policy'
import { DEMO_LEARNER, DEMO_TEACHER } from '../demo/policy'
import { resolveActor } from './actor'

function authWith(
  session: { userId: string; role: 'learner'; name: string } | null,
) {
  return {
    read: async (token: string | undefined) =>
      token === 'sid' ? session : null,
  }
}

const env = {
  nodeEnv: 'development',
  demo: '1',
  previewRole: 'learner',
}

describe('resolveActor', () => {
  it('prefers a real cookie session over the preview header', async () => {
    const session = { userId: 'real', role: 'learner' as const, name: 'Ada' }
    const actor = await resolveActor({
      auth: authWith(session),
      cookie: `${SESSION_COOKIE}=sid`,
      authorization: undefined,
      previewRole: 'teacher',
      env,
    })
    expect(actor).toEqual(session)
  })

  it('maps a preview role to the seeded demo user when demo is on', async () => {
    const actor = await resolveActor({
      auth: authWith(null),
      cookie: undefined,
      authorization: undefined,
      previewRole: 'teacher',
      env,
    })
    expect(actor).toEqual({
      userId: DEMO_TEACHER.userId,
      role: 'teacher',
      name: DEMO_TEACHER.name,
    })
  })

  it('falls back to the env preview role and refuses production', async () => {
    const local = await resolveActor({
      auth: authWith(null),
      cookie: undefined,
      authorization: undefined,
      previewRole: undefined,
      env,
    })
    expect(local).toMatchObject({
      userId: DEMO_LEARNER.userId,
      role: 'learner',
    })
    const prod = await resolveActor({
      auth: authWith(null),
      cookie: undefined,
      authorization: undefined,
      previewRole: 'teacher',
      env: { nodeEnv: 'production', demo: '1', previewRole: 'teacher' },
    })
    expect(prod).toBeNull()
  })

  it('rejects a bearer session header', async () => {
    const actor = await resolveActor({
      auth: authWith(null),
      cookie: undefined,
      authorization: 'Bearer abc',
      previewRole: 'teacher',
      env,
    })
    expect(actor).toBe('bearer')
  })
})
