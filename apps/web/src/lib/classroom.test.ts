import { describe, expect, it, vi } from 'vitest'
import { formatLessonTime, groupsView, tashkentInputToIso } from './classroom'

describe('formatLessonTime', () => {
  it('uses Uzbek short months even when Intl lacks Uzbek locale data', () => {
    const DateTimeFormat = Intl.DateTimeFormat
    const formatter = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(function fallbackDateTimeFormat(locale, options) {
        return new DateTimeFormat(
          locale === 'uz' || locale === 'uz-UZ' ? 'en' : locale,
          options,
        )
      })
    try {
      const months = [
        'yan',
        'fev',
        'mar',
        'apr',
        'may',
        'iyn',
        'iyl',
        'avg',
        'sen',
        'okt',
        'noy',
        'dek',
      ]
      for (const [month, name] of months.entries()) {
        const iso = new Date(Date.UTC(2026, month, 1, 20, 30)).toISOString()
        for (const locale of ['uz', 'uz-UZ']) {
          expect(formatLessonTime(iso, locale)).toBe(`2-${name}, 2026, 01:30`)
        }
      }
    } finally {
      formatter.mockRestore()
    }
  })

  it('uses the Tashkent date across month and year boundaries, including midnight', () => {
    expect(formatLessonTime('2026-10-31T19:00:00Z', 'uz')).toBe(
      '1-noy, 2026, 00:00',
    )
    expect(formatLessonTime('2026-12-31T20:30:00Z', 'uz')).toBe(
      '1-yan, 2027, 01:30',
    )
  })

  it.each(['ru', 'en'])('preserves native Intl output for %s', (locale) => {
    const iso = '2026-10-31T20:30:00Z'
    expect(formatLessonTime(iso, locale)).toBe(
      new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Tashkent',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso)),
    )
  })

  it('preserves invalid input for every locale', () => {
    for (const locale of ['uz', 'ru', 'en']) {
      expect(formatLessonTime('invalid', locale)).toBe('invalid')
    }
  })
})

const can = {
  createLesson: false,
  manageMembers: false,
  seeMembers: false,
  assignTest: false,
  viewAssignments: false,
  gradeAttempts: false,
}

describe('groupsView', () => {
  it('keeps the empty state when the session has no groups', () => {
    expect(groupsView({ groups: [], can: { createGroup: false } })).toEqual({
      empty: true,
      canCreate: false,
      groups: [],
    })
  })

  it('shows a learner their groups from a count, never a member list', () => {
    const groups = [
      {
        id: 'g1',
        name: 'A1',
        kind: 'adult' as const,
        capacity: 12,
        learnerCount: 3,
        can,
      },
    ]
    const view = groupsView({ groups, can: { createGroup: false } })
    expect(view.groups[0]).not.toHaveProperty('memberIds')
    expect(view.groups[0].learnerCount).toBe(3)
  })

  it('takes the create permission from the API, not from the role', () => {
    const groups = [
      {
        id: 'g1',
        name: 'A1',
        kind: 'adult' as const,
        capacity: 12,
        learnerCount: 0,
        can,
      },
    ]
    expect(groupsView({ groups, can: { createGroup: true } })).toEqual({
      empty: false,
      canCreate: true,
      groups,
    })
  })
})

describe('tashkentInputToIso', () => {
  it('reads wall time as Asia/Tashkent, not the device zone', () => {
    const original = process.env.TZ
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone
      expect(tashkentInputToIso('2026-11-01T09:00')).toBe(
        '2026-11-01T04:00:00.000Z',
      )
    }
    process.env.TZ = original
    expect(tashkentInputToIso('2026-11-01T09:00:30')).toBe(
      '2026-11-01T04:00:30.000Z',
    )
  })

  it('refuses an incomplete or invalid value', () => {
    for (const value of ['', '2026-11-01', '2026-13-01T09:00', 'x']) {
      expect(tashkentInputToIso(value)).toBeNull()
    }
  })
})
