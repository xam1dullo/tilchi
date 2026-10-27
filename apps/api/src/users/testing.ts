import type { UserDirectory } from '../auth/auth.service'
import type { UserRecord } from './users.repository'

type Upsert = Parameters<UserDirectory['upsertTelegram']>[0]

// In-memory stand-in for UsersRepository: a stable id per telegram account,
// with optional delay, refusal (soft-deleted) and failure for race tests.
export function fakeUsers(
  options: { delayMs?: number; refuse?: string[]; fail?: number } = {},
): UserDirectory {
  const ids = new Map<string, string>()
  let failures = options.fail ?? 0
  return {
    async upsertTelegram(input: Upsert): Promise<UserRecord | null> {
      if (options.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs))
      }
      if (failures-- > 0) throw new Error('database down')
      if (options.refuse?.includes(input.telegramUserId)) return null
      const id = ids.get(input.telegramUserId) ?? `user-${ids.size + 1}`
      ids.set(input.telegramUserId, id)
      return {
        id,
        telegramUserId: input.telegramUserId,
        role: input.role,
        name: input.name ?? null,
      }
    },
  }
}
