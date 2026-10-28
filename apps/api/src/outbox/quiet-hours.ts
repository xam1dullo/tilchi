const HOUR_MS = 60 * 60 * 1000
/** Asia/Tashkent is UTC+5 all year (no daylight saving). */
export const TASHKENT_OFFSET_MS = 5 * HOUR_MS
const QUIET_FROM = 22
const QUIET_TO = 8

const tashkentHour = (at: Date) =>
  new Date(at.getTime() + TASHKENT_OFFSET_MS).getUTCHours()

/**
 * Null outside quiet hours (22:00-08:00 Asia/Tashkent). Inside them, the next
 * 08:00 Tashkent, when a non-urgent Telegram message may go out.
 */
export function quietHoursEnd(at: Date): Date | null {
  const hour = tashkentHour(at)
  if (hour < QUIET_FROM && hour >= QUIET_TO) return null
  const local = new Date(at.getTime() + TASHKENT_OFFSET_MS)
  const day = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + (hour >= QUIET_FROM ? 1 : 0),
    QUIET_TO,
  )
  return new Date(day - TASHKENT_OFFSET_MS)
}
