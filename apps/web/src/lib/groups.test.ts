import { describe, expect, it } from 'vitest'
import { readGroups } from './groups'

const row = {
  id: '5c2f1f1e-9a53-4a42-8f0e-0d2d4a9a7b11',
  name: 'IELTS evening',
  capacity: 5,
  memberCount: 3,
  teacher: { id: '8d7a0a28-3f3c-4cb7-9b53-0f6f6d1d2c10', name: 'Mukhtasar' },
  createdAt: '2026-10-27T09:00:00.000Z',
}

describe('readGroups', () => {
  it('reads the list the API returns and keeps only what the page shows', () => {
    const [group] = readGroups({ groups: [{ ...row, secret: 'x' }] })
    expect(group).toEqual({
      id: row.id,
      name: row.name,
      capacity: 5,
      memberCount: 3,
      teacherName: 'Mukhtasar',
    })
  })

  it('accepts a teacher without a name', () => {
    const [group] = readGroups({
      groups: [{ ...row, teacher: { id: row.teacher.id, name: null } }],
    })
    expect(group?.teacherName).toBeNull()
  })

  it('reads an empty list as empty', () => {
    expect(readGroups({ groups: [] })).toEqual([])
  })

  // An unreadable body must be an error row, never the "no group yet" screen.
  it.each([
    ['null', null],
    ['a string', 'groups'],
    ['no groups key', {}],
    ['groups that is not a list', { groups: {} }],
    ['a row that is not an object', { groups: [null] }],
    ['a row without an id', { groups: [{ ...row, id: undefined }] }],
    ['a row with a numeric name', { groups: [{ ...row, name: 7 }] }],
    ['a row with a text capacity', { groups: [{ ...row, capacity: '5' }] }],
    ['a row with no member count', { groups: [{ ...row, memberCount: null }] }],
    ['a row without a teacher', { groups: [{ ...row, teacher: undefined }] }],
    [
      'a teacher name that is a number',
      { groups: [{ ...row, teacher: { name: 1 } }] },
    ],
  ])('rejects %s', (_label, body) => {
    expect(() => readGroups(body)).toThrow('bad_groups')
  })
})
