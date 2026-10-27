import { describe, expect, it } from 'vitest'
import {
  GROUP_CAPACITY_MAX,
  GROUP_NAME_MAX,
  canCreateGroup,
  canManageGroups,
  chooseTeacher,
  parseGroupInput,
  parseMemberInput,
  teachesGroup,
} from './policy'

const SELF = '0192f000-0000-7000-8000-000000000001'
const OTHER = '0192f000-0000-7000-8000-000000000002'

describe('group permissions', () => {
  it('lets an admin or a teacher create a group, never a learner', () => {
    expect(canCreateGroup('admin')).toBe(true)
    expect(canCreateGroup('teacher')).toBe(true)
    expect(canCreateGroup('learner')).toBe(false)
  })

  it('keeps membership and deletion with the admin', () => {
    expect(canManageGroups('admin')).toBe(true)
    expect(canManageGroups('teacher')).toBe(false)
    expect(canManageGroups('learner')).toBe(false)
  })
})

describe('teachesGroup', () => {
  it('is true for an admin and for the named teacher', () => {
    expect(teachesGroup({ userId: OTHER, role: 'admin' }, SELF)).toBe(true)
    expect(teachesGroup({ userId: SELF, role: 'teacher' }, SELF)).toBe(true)
  })

  it('is false for another teacher, a learner, or a demoted teacher', () => {
    expect(teachesGroup({ userId: OTHER, role: 'teacher' }, SELF)).toBe(false)
    expect(teachesGroup({ userId: OTHER, role: 'learner' }, SELF)).toBe(false)
    expect(teachesGroup({ userId: SELF, role: 'learner' }, SELF)).toBe(false)
  })
})

describe('parseGroupInput', () => {
  const parsed = (body: unknown) => parseGroupInput(body)

  it('trims the name and defaults to the largest group', () => {
    expect(parsed({ name: '  A1 morning  ' })).toEqual({
      ok: true,
      value: {
        name: 'A1 morning',
        capacity: GROUP_CAPACITY_MAX,
        teacherId: null,
      },
    })
  })

  it('accepts capacity from 1 to 12 and a teacher id in any letter case', () => {
    const upper = SELF.toUpperCase()
    expect(parsed({ name: 'x', capacity: 1, teacherId: upper })).toEqual({
      ok: true,
      value: { name: 'x', capacity: 1, teacherId: SELF },
    })
    expect(parsed({ name: 'x', capacity: 12 }).ok).toBe(true)
  })

  it.each([[null], [[]], ['name'], [undefined]])(
    'refuses a body that is not an object: %j',
    (body) => {
      expect(parsed(body)).toEqual({
        ok: false,
        status: 400,
        error: 'bad_request',
      })
    },
  )

  it.each([
    [{}],
    [{ name: '' }],
    [{ name: '   ' }],
    [{ name: 7 }],
    [{ name: 'a\nb' }],
    [{ name: 'a\u0000b' }],
    [{ name: 'x'.repeat(GROUP_NAME_MAX + 1) }],
  ])('refuses a bad name: %j', (body) => {
    expect(parsed(body)).toEqual({ ok: false, status: 400, error: 'bad_name' })
  })

  it('allows a name of exactly the maximum length', () => {
    expect(parsed({ name: 'x'.repeat(GROUP_NAME_MAX) }).ok).toBe(true)
  })

  it.each([[0], [13], [1.5], ['5'], [null], [Number.NaN]])(
    'refuses capacity %j',
    (capacity) => {
      expect(parsed({ name: 'x', capacity })).toEqual({
        ok: false,
        status: 400,
        error: 'bad_capacity',
      })
    },
  )

  it.each([[null], [''], ['nope'], [12]])(
    'refuses teacher id %j',
    (teacherId) => {
      expect(parsed({ name: 'x', teacherId })).toEqual({
        ok: false,
        status: 400,
        error: 'bad_teacher',
      })
    },
  )
})

describe('chooseTeacher', () => {
  it('makes a teacher the teacher of their own group', () => {
    const actor = { userId: SELF, role: 'teacher' as const }
    expect(chooseTeacher(actor, null)).toEqual({ ok: true, value: SELF })
    expect(chooseTeacher(actor, SELF)).toEqual({ ok: true, value: SELF })
  })

  it('stops a teacher naming someone else', () => {
    const actor = { userId: SELF, role: 'teacher' as const }
    expect(chooseTeacher(actor, OTHER)).toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
    })
  })

  it('makes an admin name the teacher', () => {
    const actor = { userId: SELF, role: 'admin' as const }
    expect(chooseTeacher(actor, OTHER)).toEqual({ ok: true, value: OTHER })
    expect(chooseTeacher(actor, null)).toEqual({
      ok: false,
      status: 400,
      error: 'bad_teacher',
    })
  })

  it('never lets a learner pick a teacher', () => {
    const actor = { userId: SELF, role: 'learner' as const }
    expect(chooseTeacher(actor, SELF)).toMatchObject({ ok: false, status: 403 })
  })
})

describe('parseMemberInput', () => {
  it('reads the user id', () => {
    expect(parseMemberInput({ userId: SELF.toUpperCase() })).toEqual({
      ok: true,
      value: SELF,
    })
  })

  it.each([[{}], [{ userId: 'nope' }], [{ userId: 5 }], [null], ['x']])(
    'refuses %j',
    (body) => {
      expect(parseMemberInput(body)).toEqual({
        ok: false,
        status: 400,
        error: 'bad_user',
      })
    },
  )
})
