import { describe, expect, it } from 'vitest'
import { channelsFor, isUrgent } from './events'
import { renderMessage, tashkentTime, telegramText } from './messages'
import { quietHoursEnd } from './quiet-hours'
import { type Member, recipientsFor } from './recipients'
import { reminderEntries } from './reminders'
import { MAX_ATTEMPTS, backoffMs, isExhausted } from './retry'

const at = (local: string) => new Date(`${local}+05:00`)

describe('quietHoursEnd (Asia/Tashkent 22:00-08:00)', () => {
  it('is null while sending is allowed, edges included', () => {
    expect(quietHoursEnd(at('2030-01-01T08:00:00'))).toBeNull()
    expect(quietHoursEnd(at('2030-01-01T12:30:00'))).toBeNull()
    expect(quietHoursEnd(at('2030-01-01T21:59:59'))).toBeNull()
  })

  it('pushes the evening to 08:00 the next day', () => {
    expect(quietHoursEnd(at('2030-01-01T22:00:00'))).toEqual(
      at('2030-01-02T08:00:00'),
    )
    expect(quietHoursEnd(at('2030-01-01T23:59:59'))).toEqual(
      at('2030-01-02T08:00:00'),
    )
  })

  it('pushes the small hours to 08:00 the same day', () => {
    expect(quietHoursEnd(at('2030-01-02T00:00:00'))).toEqual(
      at('2030-01-02T08:00:00'),
    )
    expect(quietHoursEnd(at('2030-01-02T07:59:59'))).toEqual(
      at('2030-01-02T08:00:00'),
    )
  })

  it('reads the Tashkent clock, not the UTC one, across month and year ends', () => {
    // 20:30 UTC on 31 Dec is already 01:30 on 1 Jan in Tashkent
    expect(quietHoursEnd(new Date('2029-12-31T20:30:00Z'))).toEqual(
      at('2030-01-01T08:00:00'),
    )
    expect(quietHoursEnd(at('2029-12-31T23:00:00'))).toEqual(
      at('2030-01-01T08:00:00'),
    )
  })
})

describe('retry backoff', () => {
  it('doubles from 30 s and caps at one hour', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([30_000, 60_000, 120_000])
    expect(backoffMs(20)).toBe(3_600_000)
  })

  it('gives up after the maximum attempts', () => {
    expect(isExhausted(MAX_ATTEMPTS - 1)).toBe(false)
    expect(isExhausted(MAX_ATTEMPTS)).toBe(true)
  })
})

describe('reminderEntries', () => {
  const lesson = {
    id: 'l1',
    groupId: 'g1',
    scheduledAt: at('2030-01-02T10:00:00'),
  }

  it('queues T-24 h and T-15 min with distinct keys', () => {
    const entries = reminderEntries(lesson, 'r1', at('2030-01-01T00:00:00'))
    expect(entries.map((e) => e.availableAt)).toEqual([
      at('2030-01-01T10:00:00'),
      at('2030-01-02T09:45:00'),
    ])
    expect(new Set(entries.map((e) => e.idempotencyKey)).size).toBe(2)
    expect(entries[0]?.payload).toMatchObject({
      lessonId: 'l1',
      scheduledAt: lesson.scheduledAt.toISOString(),
      lead: '24h',
    })
  })

  it('skips a lead that is already past', () => {
    const entries = reminderEntries(lesson, 'r1', at('2030-01-02T08:00:00'))
    expect(entries.map((e) => (e.payload as { lead: string }).lead)).toEqual([
      '15m',
    ])
    expect(reminderEntries(lesson, 'r1', at('2030-01-02T09:50:00'))).toEqual([])
  })

  it('keys differ per revision, so moving a lesson away and back is fresh', () => {
    const a = reminderEntries(lesson, 'one', at('2030-01-01T00:00:00'))
    const b = reminderEntries(lesson, 'two', at('2030-01-01T00:00:00'))
    expect(a[0]?.idempotencyKey).not.toBe(b[0]?.idempotencyKey)
  })
})

describe('recipientsFor', () => {
  const member = (
    userId: string,
    role: Member['role'],
    telegramId: string | null = null,
  ): Member => ({ userId, role, telegramId })
  const scope = {
    teacherId: 't',
    members: [
      member('t', 'teacher'),
      member('a', 'learner', '1'),
      member('b', 'learner', '2'),
    ],
    joinedIds: ['a'],
    subject: member('s', 'learner', '9'),
  }
  const ids = (event: Parameters<typeof recipientsFor>[0]) =>
    recipientsFor(event, scope).map((m) => m.userId)

  it('sends lesson changes to learners only', () => {
    for (const event of [
      'lesson.scheduled',
      'lesson.cancelled',
      'lesson.rescheduled',
    ] as const) {
      expect(ids(event)).toEqual(['a', 'b'])
    }
  })

  it('reminds learners and the group teacher', () => {
    expect(ids('lesson.reminder')).toEqual(['a', 'b', 't'])
  })

  it('tells only learners who have not joined that the lesson started', () => {
    expect(ids('lesson.started')).toEqual(['b'])
  })

  it('addresses revoke-all to the user, and nobody for admin alerts or tasks', () => {
    expect(ids('sessions.revoked')).toEqual(['s'])
    expect(ids('registration.completed')).toEqual([])
    expect(ids('meeting.close')).toEqual([])
  })
})

describe('events', () => {
  it('treats start, revoke and the 15 min reminder as urgent', () => {
    expect(isUrgent('lesson.started')).toBe(true)
    expect(isUrgent('sessions.revoked')).toBe(true)
    expect(isUrgent('lesson.reminder', { lead: '15m' })).toBe(true)
    expect(isUrgent('lesson.reminder', { lead: '24h' })).toBe(false)
    expect(isUrgent('lesson.scheduled')).toBe(false)
    expect(isUrgent('lesson.cancelled')).toBe(false)
  })

  it('routes channels per the catalog', () => {
    expect(channelsFor('lesson.scheduled')).toEqual({
      web: true,
      telegram: true,
    })
    expect(channelsFor('registration.completed')).toEqual({
      web: false,
      telegram: true,
    })
    expect(channelsFor('meeting.close')).toEqual({
      web: false,
      telegram: false,
    })
  })
})

describe('messages', () => {
  it('shows times in Asia/Tashkent, 24-hour', () => {
    expect(tashkentTime('2030-01-01T04:05:00Z')).toBe('01.01 09:05')
    expect(tashkentTime('2029-12-31T20:00:00Z')).toBe('01.01 01:00')
  })

  it('renders a link into the app and no personal data in lesson messages', () => {
    const message = renderMessage('lesson.started', {
      lessonId: 'L',
      groupId: 'G',
      scheduledAt: '2030-01-01T04:00:00Z',
      phone: '+998901112233',
      name: 'Ada',
    })
    expect(message?.link).toBe('/app/meet/L')
    expect(JSON.stringify(message)).not.toMatch(/998|Ada/)
    expect(telegramText(message!, 'https://app.example/')).toContain(
      'https://app.example/app/meet/L',
    )
    expect(telegramText(message!, undefined)).not.toContain('http')
  })

  it('names both times when a lesson moves', () => {
    const message = renderMessage('lesson.rescheduled', {
      groupId: 'G',
      scheduledAt: '2030-01-02T05:00:00Z',
      previousScheduledAt: '2030-01-01T04:00:00Z',
    })
    expect(message?.body).toContain('01.01 09:00')
    expect(message?.body).toContain('02.01 10:00')
  })

  it('has no text for a task event', () => {
    expect(renderMessage('meeting.close', {})).toBeNull()
  })
})
