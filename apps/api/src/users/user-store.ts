import { uuidv7 } from '../id'
import type { Role } from '../auth/policy'

export type User = {
  id: string
  telegramUserId: string
  role: Role
  name: string | null
}

function parseList(value: string | undefined) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

export function roleForTelegram(telegramUserId: string): Role {
  if (parseList(process.env.TELEGRAM_ADMIN_ALLOWLIST).has(telegramUserId))
    return 'admin'
  if (parseList(process.env.TELEGRAM_TEACHER_ALLOWLIST).has(telegramUserId))
    return 'teacher'
  return 'learner'
}

export class UserStore {
  private readonly byTelegram = new Map<string, User>()
  private readonly byId = new Map<string, User>()

  upsertTelegram(telegramUserId: string, name?: string | null): User {
    const existing = this.byTelegram.get(telegramUserId)
    if (existing) {
      if (name && name !== existing.name) existing.name = name
      existing.role = roleForTelegram(telegramUserId)
      return existing
    }
    const user: User = {
      id: uuidv7(),
      telegramUserId,
      role: roleForTelegram(telegramUserId),
      name: name ?? null,
    }
    this.byTelegram.set(telegramUserId, user)
    this.byId.set(user.id, user)
    return user
  }

  get(id: string) {
    return this.byId.get(id) ?? null
  }
}
