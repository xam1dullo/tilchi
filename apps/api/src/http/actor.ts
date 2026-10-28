import { HttpException, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import {
  SESSION_COOKIE,
  bearerSessionRejected,
  readCookie,
} from '../auth/policy'
import {
  demoActor,
  demoEnabled,
  parsePreviewRole,
  processDemoEnv,
} from '../demo/policy'
import type { Actor } from '../groups/access'

export async function resolveActor(input: {
  auth: Pick<AuthService, 'read'>
  cookie: string | undefined
  authorization: string | undefined
  previewRole: string | undefined
  env?: {
    nodeEnv: string | undefined
    demo: string | undefined
    previewRole: string | undefined
  }
}): Promise<Actor | 'bearer' | null> {
  if (bearerSessionRejected(input.authorization)) return 'bearer'
  const session = await input.auth.read(
    readCookie(input.cookie, SESSION_COOKIE),
  )
  if (session) return session
  const env = input.env ?? processDemoEnv()
  if (!demoEnabled(env)) return null
  const role =
    parsePreviewRole(input.previewRole) ?? parsePreviewRole(env.previewRole)
  if (!role) return null
  const demo = demoActor(role)
  return { userId: demo.userId, role: demo.role, name: demo.name }
}

export async function requireActor(input: {
  auth: Pick<AuthService, 'read'>
  cookie: string | undefined
  authorization: string | undefined
  previewRole: string | undefined
}): Promise<Actor> {
  const actor = await resolveActor(input)
  if (actor === 'bearer') {
    throw new HttpException({ error: 'cookie_session_required' }, 400)
  }
  if (!actor) throw new UnauthorizedException()
  return actor
}
