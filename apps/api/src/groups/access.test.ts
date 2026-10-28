import { describe, expect, it } from 'vitest'
import { canManageGroup, canSeeGroup, groupView } from './access'
import type { Group } from './groups.service'

const group: Group = {
  id: 'group',
  name: 'A1',
  capacity: 12,
  kind: 'adult',
  createdBy: 'owner',
  memberIds: ['owner', 'other-teacher', 'learner'],
}

describe('group management access', () => {
  it('allows the owning teacher', () => {
    expect(
      canManageGroup({ userId: 'owner', role: 'teacher', name: null }, group),
    ).toBe(true)
  })

  it('allows an admin outside the group', () => {
    expect(
      canManageGroup({ userId: 'admin', role: 'admin', name: null }, group),
    ).toBe(true)
  })

  it('lets a visiting teacher see the group without managing it', () => {
    const actor = {
      userId: 'other-teacher',
      role: 'teacher' as const,
      name: null,
    }
    expect(canSeeGroup(actor, group)).toBe(true)
    expect(canManageGroup(actor, group)).toBe(false)
  })

  it('refuses learner management', () => {
    expect(
      canManageGroup({ userId: 'learner', role: 'learner', name: null }, group),
    ).toBe(false)
  })
})

describe('group view (XAM-792)', () => {
  const view = (userId: string, role: 'teacher' | 'admin' | 'learner') =>
    groupView({ userId, role, name: null }, group)

  it('gives member ids to the owning teacher and admins', () => {
    expect(view('owner', 'teacher')).toHaveProperty('memberIds')
    expect(view('admin', 'admin')).toHaveProperty('memberIds')
  })

  it('hides member ids from learners and visiting teachers', () => {
    expect(view('learner', 'learner')).not.toHaveProperty('memberIds')
    expect(view('other-teacher', 'teacher')).not.toHaveProperty('memberIds')
  })
})
