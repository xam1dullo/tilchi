import type { ExecutionContext } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthService } from './auth.service'
import { SessionGuard } from './session.guard'
import { RoleAllowlist } from '../users/roles'
import { fakeUsers } from '../users/testing'

async function openSession() {
  const auth = new AuthService(
    fakeUsers(),
    new RoleAllowlist(new Set(), new Set()),
  )
  const { handoffId, claim } = auth.start({ ip: '203.0.113.1' })
  await auth.confirm(handoffId, { id: '42', name: 'Aziza' })
  const opened = auth.claim(claim)
  if (opened.status !== 'confirmed') throw new Error(opened.status)
  return { auth, token: opened.token }
}

function contextFor(headers: Record<string, string>) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  }
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
  return { context, request }
}

describe('SessionGuard', () => {
  it('lets a valid session cookie through and exposes the user', async () => {
    const { auth, token } = await openSession()
    const { context, request } = contextFor({
      cookie: `__Host-tilchi_sid=${token}`,
    })
    expect(new SessionGuard(auth).canActivate(context)).toBe(true)
    expect(request.user).toMatchObject({ role: 'learner', name: 'Aziza' })
  })

  it('answers 401 without a session or with an unknown one', async () => {
    const { auth } = await openSession()
    const attempts: Record<string, string>[] = [
      {},
      { cookie: '__Host-tilchi_sid=nope' },
      { cookie: 'a=b' },
    ]
    for (const headers of attempts) {
      const { context } = contextFor(headers)
      expect(() => new SessionGuard(auth).canActivate(context)).toThrowError(
        expect.objectContaining({
          status: 401,
          response: { error: 'unauthorized' },
        }),
      )
    }
  })

  it('refuses a bearer token even next to a valid cookie', async () => {
    const { auth, token } = await openSession()
    const { context, request } = contextFor({
      authorization: `Bearer ${token}`,
      cookie: `__Host-tilchi_sid=${token}`,
    })
    expect(() => new SessionGuard(auth).canActivate(context)).toThrowError(
      expect.objectContaining({ status: 400 }),
    )
    expect(request.user).toBeUndefined()
  })
})
