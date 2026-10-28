import { describe, expect, it } from 'vitest'
import { groupsView, lessonActions } from './classroom'

describe('groupsView', () => {
  it('keeps the empty state when the session has no groups', () => {
    expect(groupsView({ role: 'learner', groups: [] })).toEqual({
      empty: true,
      canCreate: false,
      groups: [],
    })
  })

  it('lets teachers create and lists membership groups', () => {
    const groups = [{ id: 'g1', name: 'A1', capacity: 12, memberIds: ['t1'] }]
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
