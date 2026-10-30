import { describe, expect, it } from 'vitest'
import { groupsView, tashkentInputToIso } from './classroom'

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
