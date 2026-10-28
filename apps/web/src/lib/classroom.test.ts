import { describe, expect, it } from 'vitest'
import { groupsView, lessonActions, tashkentInputToIso } from './classroom'

describe('groupsView', () => {
  it('keeps the empty state when the session has no groups', () => {
    expect(groupsView({ role: 'learner', groups: [] })).toEqual({
      empty: true,
      canCreate: false,
      groups: [],
    })
  })

  it('shows a learner their groups from a count, never a member list', () => {
    const groups = [{ id: 'g1', name: 'A1', capacity: 12, learnerCount: 3 }]
    const view = groupsView({ role: 'learner', groups })
    expect(view.groups[0]).not.toHaveProperty('memberIds')
    expect(view.groups[0].learnerCount).toBe(3)
  })

  it('lets teachers create and lists membership groups', () => {
    const groups = [{ id: 'g1', name: 'A1', capacity: 12, learnerCount: 0 }]
    expect(groupsView({ role: 'teacher', groups })).toEqual({
      empty: false,
      canCreate: true,
      groups,
    })
  })
})

describe('lessonActions', () => {
  it('lets a teacher start and end, and anyone join only while live', () => {
    expect(lessonActions({ role: 'teacher', status: 'scheduled' })).toEqual({
      canSchedule: true,
      canStart: true,
      canEnd: false,
      canJoin: false,
    })
    expect(lessonActions({ role: 'learner', status: 'live' })).toEqual({
      canSchedule: false,
      canStart: false,
      canEnd: false,
      canJoin: true,
    })
    expect(lessonActions({ role: 'learner', status: 'ended' }).canJoin).toBe(
      false,
    )
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
