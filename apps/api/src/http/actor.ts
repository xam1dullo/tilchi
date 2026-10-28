import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { AuthService } from '../auth/auth.service'
import {
  SESSION_COOKIE,
  bearerSessionRejected,
  readCookie,
} from '../auth/policy'
import {
  PREVIEW_HEADER,
  demoActor,
  demoEnabled,
  parsePreviewRole,
  processDemoEnv,
} from '../demo/policy'
import type { Actor as ActorShape } from '../authz/policy'

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
}): Promise<ActorShape | 'bearer' | null> {
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

export type Actor = ActorShape

export const PUBLIC = 'tilchi:public'

/** Marks a controller or route that anyone may call: health, login, webhooks. */
export const Public = () => SetMetadata(PUBLIC, true)

type ActorRequest = Request & { actor?: ActorShape }

/**
 * Global guard: every route needs a signed-in Actor unless it is `@Public()`.
 * The one place that reads the session cookie and the dev/test preview header.
 */
@Injectable()
export class ActorGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: Pick<AuthService, 'read'>,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true
    }
    const request = context.switchToHttp().getRequest<ActorRequest>()
    const actor = await resolveActor({
      auth: this.auth,
      cookie: request.headers.cookie,
      authorization: request.headers.authorization,
      previewRole: request.headers[PREVIEW_HEADER] as string | undefined,
    })
    if (actor === 'bearer') {
      throw new HttpException({ error: 'cookie_session_required' }, 400)
    }
    if (!actor) throw new UnauthorizedException()
    request.actor = actor
    return true
  }
}

/** The signed-in caller, put there by `ActorGuard`. */
export const Actor = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<ActorRequest>().actor,
)
