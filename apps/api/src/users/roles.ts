import type { Role } from '../auth/policy'

// Telegram ids are positive integers of at most 52 bits (16 digits).
const TELEGRAM_ID = /^[1-9]\d{0,15}$/

export function parseTelegramIds(value: string | undefined) {
  const ids = new Set<string>()
  let ignored = 0
  for (const entry of (value ?? '').split(',')) {
    const id = entry.trim()
    if (TELEGRAM_ID.test(id)) ids.add(id)
    else if (id) ignored++
  }
  return { ids, ignored }
}

// Teacher and admin accounts come from an allow-list (BUILD-BRIEF, ADR 0003).
// Everyone else who confirms in the bot is a learner.
export class RoleAllowlist {
  constructor(
    private readonly admins: ReadonlySet<string>,
    private readonly teachers: ReadonlySet<string>,
  ) {}

  // A malformed entry never grants a role. It is reported so a typo is not silent.
  static fromEnv(
    env: Record<string, string | undefined>,
    warn: (message: string) => void = () => undefined,
  ) {
    const lists = (['ADMIN', 'TEACHER'] as const).map((kind) => {
      const name = `TELEGRAM_${kind}_ALLOWLIST`
      const parsed = parseTelegramIds(env[name])
      if (parsed.ignored > 0) {
        warn(`${name}: ignored ${parsed.ignored} invalid entries`)
      }
      return parsed.ids
    })
    return new RoleAllowlist(lists[0], lists[1])
  }

  roleFor(telegramUserId: string): Role {
    if (this.admins.has(telegramUserId)) return 'admin'
    if (this.teachers.has(telegramUserId)) return 'teacher'
    return 'learner'
  }
}
