import { describe, expect, it } from 'vitest'
import { actorOf } from '../test/actors'
import { type Action, authorize, can } from './policy'
import { groupView, lessonView } from './views'
import type { Group } from '../groups/groups.service'
import type { Lesson } from '../lessons/lessons.repository'

const group: Group = {
  id: 'group',
  name: 'A1',
  capacity: 12,
  kind: 'adult',
  teacherId: 'owner',
  memberIds: ['owner', 'other-teacher', 'learner'],
  learnerCount: 1,
}

const owner = actorOf('teacher', 'owner')
const visiting = actorOf('teacher', 'other-teacher')
const outsider = actorOf('teacher', 'stranger')
const learner = actorOf('learner', 'learner')
const stranger = actorOf('learner', 'nobody')
const admin = actorOf('admin', 'admin')

const MANAGE: Action[] = [
  'group.seeMembers',
  'lesson.create',
  'lesson.start',
  'lesson.end',
  'lesson.cancel',
  'lesson.reschedule',
  'meeting.moderate',
]

describe('can', () => {
  it('lets the owning teacher and any admin manage', () => {
    for (const action of MANAGE) {
      expect(can(owner, action, group), action).toBe(true)
      expect(can(admin, action, group), action).toBe(true)
    }
  })

  it('manages by the assigned teacher, not by who created the group', () => {
    const assigned = { ...group, teacherId: 'other-teacher' }
    for (const action of MANAGE) {
      expect(can(visiting, action, assigned), action).toBe(true)
      expect(can(owner, action, assigned), action).toBe(false)
    }
  })

  it('lets a visiting teacher see and join but not manage', () => {
    expect(can(visiting, 'group.view', group)).toBe(true)
    expect(can(visiting, 'meeting.join', group)).toBe(true)
    for (const action of MANAGE) {
      expect(can(visiting, action, group), action).toBe(false)
    }
  })

  it('lets a learner member see and join only', () => {
    expect(can(learner, 'group.view', group)).toBe(true)
    expect(can(learner, 'meeting.join', group)).toBe(true)
    for (const action of MANAGE) {
      expect(can(learner, action, group), action).toBe(false)
    }
  })

  it('gives people outside the group nothing but what an admin has', () => {
    for (const who of [outsider, stranger]) {
      for (const action of [...MANAGE, 'group.view', 'meeting.join'] as const) {
        expect(can(who, action, group), action).toBe(false)
      }
    }
    expect(can(admin, 'group.view', group)).toBe(true)
    expect(can(admin, 'meeting.join', group)).toBe(true)
  })

  it('lets teachers and admins create groups, only admins add members', () => {
    expect(can(owner, 'group.create')).toBe(true)
    expect(can(admin, 'group.create')).toBe(true)
    expect(can(learner, 'group.create')).toBe(false)
    expect(can(admin, 'teacher.list')).toBe(true)
    expect(can(owner, 'teacher.list')).toBe(false)
    expect(can(learner, 'teacher.list')).toBe(false)
    expect(can(admin, 'group.addMember')).toBe(true)
    expect(can(owner, 'group.addMember')).toBe(false)
  })

  it('lets only admins search learners and record guardian consent', () => {
    for (const action of ['user.search', 'user.recordConsent'] as const) {
      expect(can(admin, action), action).toBe(true)
      for (const actor of [owner, visiting, outsider, learner, stranger]) {
        expect(can(actor, action), action).toBe(false)
      }
    }
  })

  it('denies a group action when there is no group', () => {
    expect(can(admin, 'lesson.start')).toBe(false)
  })

  it('allows only admins to manage the course catalog', () => {
    expect(can(admin, 'course.manage')).toBe(true)
    for (const actor of [owner, visiting, outsider, learner, stranger]) {
      expect(can(actor, 'course.manage')).toBe(false)
    }
  })
})

describe('tests and the question bank', () => {
  it('lets teachers and admins manage the bank and compose tests, nobody else', () => {
    for (const action of ['question.manage', 'test.manage'] as const) {
      for (const actor of [owner, visiting, outsider, admin]) {
        expect(can(actor, action), action).toBe(true)
      }
      expect(can(learner, action)).toBe(false)
    }
  })

  it('lets only the assigned teacher and admins assign and review a Group', () => {
    for (const action of [
      'test.assign',
      'assignment.view',
      'attempt.grade',
    ] as const) {
      expect(can(owner, action, group), action).toBe(true)
      expect(can(admin, action, group), action).toBe(true)
      expect(can(visiting, action, group), action).toBe(false)
      expect(can(learner, action, group), action).toBe(false)
      expect(can(outsider, action, group), action).toBe(false)
      expect(can(owner, action), action).toBe(false)
    }
  })

  it('lets only learners take a test', () => {
    expect(can(learner, 'attempt.take')).toBe(true)
    for (const actor of [owner, visiting, admin]) {
      expect(can(actor, 'attempt.take')).toBe(false)
    }
  })
})

describe('authorize', () => {
  const status = (run: () => void) => {
    try {
      run()
      return 200
    } catch (error) {
      return (error as { status: number }).status
    }
  }

  it('hides a group from outsiders (404) and refuses viewers (403)', () => {
    expect(status(() => authorize(stranger, 'lesson.start', group))).toBe(404)
    expect(status(() => authorize(visiting, 'lesson.start', group))).toBe(403)
    expect(status(() => authorize(owner, 'lesson.start', group))).toBe(200)
    expect(status(() => authorize(learner, 'group.create'))).toBe(403)
  })
})

describe('views', () => {
  const lesson = (status: Lesson['status']) =>
    ({ id: 'l', groupId: 'group', status }) as Lesson

  it('hides member ids from non-managers and reports what each may do', () => {
    expect(groupView(learner, group)).not.toHaveProperty('memberIds')
    expect(groupView(visiting, group).can).toEqual({
      createLesson: false,
      manageMembers: false,
      seeMembers: false,
      assignTest: false,
      viewAssignments: false,
    })
    expect(groupView(learner, group).can.seeMembers).toBe(false)
    expect(groupView(learner, group).can.assignTest).toBe(false)
    expect(groupView(learner, group).can.viewAssignments).toBe(false)
    expect(groupView(owner, group).can.assignTest).toBe(true)
    expect(groupView(owner, group).can.viewAssignments).toBe(true)
    expect(groupView(owner, group)).toHaveProperty('memberIds')
    expect(groupView(owner, group).can.seeMembers).toBe(true)
    expect(groupView(admin, group).can).toEqual({
      createLesson: true,
      manageMembers: true,
      seeMembers: true,
      assignTest: true,
      viewAssignments: true,
    })
  })

  it('gates lesson actions by status as well as by person', () => {
    expect(lessonView(owner, group, lesson('scheduled')).can).toEqual({
      start: true,
      end: false,
      cancel: true,
      reschedule: true,
      join: false,
    })
    expect(lessonView(owner, group, lesson('live')).can).toEqual({
      start: false,
      end: true,
      cancel: false,
      reschedule: false,
      join: true,
    })
    expect(lessonView(visiting, group, lesson('scheduled')).can.start).toBe(
      false,
    )
    expect(lessonView(learner, group, lesson('live')).can).toEqual({
      start: false,
      end: false,
      cancel: false,
      reschedule: false,
      join: true,
    })
    expect(lessonView(owner, group, lesson('ended')).can.join).toBe(false)
  })
})
