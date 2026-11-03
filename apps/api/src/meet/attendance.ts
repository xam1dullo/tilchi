export type AttendanceEvent = {
  userId: string
  kind: 'token' | 'join' | 'leave'
  at: Date
}

export type AttendanceRow = {
  userId: string
  present: boolean
  seconds: number
}

/**
 * Per user: present once they joined, and the seconds inside join→leave
 * intervals clipped to the lesson window. A second join while one is open
 * and a leave with none open are ignored; an open join runs to `window.end`.
 */
export function summarizeAttendance(
  events: AttendanceEvent[],
  window: { start: Date; end: Date },
): AttendanceRow[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime())
  const open = new Map<string, number>()
  const ms = new Map<string, number>()
  const present = new Set<string>()
  const users: string[] = []
  const clip = (from: number, to: number) =>
    Math.max(
      0,
      Math.min(to, window.end.getTime()) -
        Math.max(from, window.start.getTime()),
    )
  for (const event of sorted) {
    if (!ms.has(event.userId)) {
      ms.set(event.userId, 0)
      users.push(event.userId)
    }
    const at = event.at.getTime()
    if (event.kind === 'join') {
      present.add(event.userId)
      if (!open.has(event.userId)) open.set(event.userId, at)
    } else if (event.kind === 'leave') {
      const since = open.get(event.userId)
      if (since === undefined) continue
      open.delete(event.userId)
      ms.set(event.userId, (ms.get(event.userId) ?? 0) + clip(since, at))
    }
  }
  for (const [userId, since] of open) {
    ms.set(userId, (ms.get(userId) ?? 0) + clip(since, window.end.getTime()))
  }
  return users.map((userId) => ({
    userId,
    present: present.has(userId),
    seconds: Math.floor((ms.get(userId) ?? 0) / 1000),
  }))
}
