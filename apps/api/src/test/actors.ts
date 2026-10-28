import type { Role } from '../auth/policy'
import type { Actor } from '../authz/policy'

export const actorOf = (role: Role, userId: string = role): Actor => ({
  userId,
  role,
  name: null,
})
