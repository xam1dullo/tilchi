import type { lessonStatus } from '../db/schema'
import { isRecord } from '../http/params'
import { type Result, fail, ok } from '../http/result'

export type LessonStatus = (typeof lessonStatus.enumValues)[number]
export type LessonAction = 'start' | 'end' | 'cancel'

const DAY_MS = 24 * 60 * 60 * 1000

// A lesson may be put on the calendar a day late (clock skew, "start now") and
// up to a year ahead; anything else is a typo.
export const SCHEDULE_PAST_TOLERANCE_MS = DAY_MS
export const SCHEDULE_HORIZON_MS = 366 * DAY_MS

// scheduled -> live -> ended, or scheduled -> cancelled. Nothing moves back.
export const TRANSITIONS: Record<
  LessonAction,
  { from: LessonStatus; to: LessonStatus; error: string }
> = {
  start: { from: 'scheduled', to: 'live', error: 'lesson_not_scheduled' },
  end: { from: 'live', to: 'ended', error: 'lesson_not_live' },
  cancel: { from: 'scheduled', to: 'cancelled', error: 'lesson_not_scheduled' },
}

// An explicit UTC offset is required: a bare local time would be read in the
// server's zone, which is not the zone the teacher meant.
const ISO =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/

const bad = () => fail(400, 'bad_time')

// Date.parse refuses out-of-range minutes, seconds and offsets, but it rolls an
// impossible day (Feb 30) into the next month and reads 24:00 as midnight, so
// those two are checked here.
export function parseScheduledAt(body: unknown, now: Date): Result<Date> {
  if (!isRecord(body) || typeof body.scheduledAt !== 'string') return bad()
  const match = ISO.exec(body.scheduledAt)
  if (!match) return bad()

  const [, year, month, day, hour] = match
  const calendarDay = new Date(Date.UTC(+year, +month - 1, +day))
  if (calendarDay.getUTCMonth() !== +month - 1 || +hour > 23) return bad()

  const at = new Date(body.scheduledAt)
  const earliest = now.getTime() - SCHEDULE_PAST_TOLERANCE_MS
  const latest = now.getTime() + SCHEDULE_HORIZON_MS
  if (
    Number.isNaN(at.getTime()) ||
    at.getTime() < earliest ||
    at.getTime() > latest
  ) {
    return bad()
  }
  return ok(at)
}
