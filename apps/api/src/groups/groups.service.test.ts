import { describe, expect, it } from 'vitest'
import { GroupsService } from './groups.service'

describe('GroupsService', () => {
  it('lets teachers create and only admins add members', () => {
    const groups = new GroupsService()
    const group = groups.create({ name: 'A1', actorId: 't1', role: 'teacher' })
    expect(group.capacity).toBe(12)
    expect(groups.listForUser('t1')[0]?.id).toBe(group.id)
    expect(() =>
      groups.addMember({ groupId: group.id, userId: 'u1', role: 'teacher' }),
    ).toThrow()
    const withMember = groups.addMember({
      groupId: group.id,
      userId: 'u1',
      role: 'admin',
    })
    expect(withMember.memberIds).toEqual(['t1', 'u1'])
    expect(groups.listForUser('u1')[0]?.id).toBe(group.id)
  })

  it('lists every group for an admin and keeps ensure idempotent', () => {
    const groups = new GroupsService()
    const first = groups.ensure({
      id: 'g1',
      name: 'A1',
      actorId: 't1',
    })
    const second = groups.ensure({
      id: 'g1',
      name: 'ignored',
      actorId: 't2',
    })
    groups.putMember('g1', 'u1')
    expect(second.id).toBe(first.id)
    expect(second.memberIds).toEqual(['t1', 'u1'])
    expect(groups.listForUser('admin', 'admin')).toHaveLength(1)
    expect(groups.listForUser('u1', 'learner')).toHaveLength(1)
  })
})
