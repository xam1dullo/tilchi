import { describe, expect, it } from 'vitest'
import { canManageGroup, canSeeGroup } from './access'
import type { Group } from './groups.service'

const group: Group = {
  id: 'group',
  name: 'A1',
  capacity: 12,
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
