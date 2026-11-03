import { describe, expect, it } from 'vitest'
import { homeView } from './home'

const group = (id: string, name: string) => ({
  id,
  name,
  kind: 'adult' as const,
  capacity: 12,
  learnerCount: 3,
  can: {
    createLesson: false,
    manageMembers: false,
    seeMembers: false,
    assignTest: false,
    viewAssignments: false,
    gradeAttempts: false,
  },
})
const lesson = (
  id: string,
  groupId: string,
  scheduledAt: string,
  status: 'scheduled' | 'live' | 'ended' | 'cancelled' = 'scheduled',
) => ({
  id,
  groupId,
  scheduledAt,
  status,
  meetingId: null,
  can: {
    start: false,
    end: false,
    cancel: false,
    reschedule: false,
    join: status === 'live',
  },
})
const assignment = (
  title: string,
  deadline: string,
  status: 'assigned' | 'submitted' | 'graded' | 'missed' = 'assigned',
) => ({
  attemptId: `a-${title}`,
  assignmentId: `as-${title}`,
  groupId: 'g1',
  groupName: 'A1',
  title,
  deadline,
  status,
  score: null,
  submittedAt: null,
})
const NOW = Date.parse('2030-01-10T06:00:00Z')

describe('homeView', () => {
  it('puts the soonest upcoming lesson across groups first, live before scheduled', () => {
    const view = homeView({
      groups: [group('g1', 'A1'), group('g2', 'B1')],
      lessonsByGroup: {
        g1: [
          lesson('old', 'g1', '2030-01-01T09:00:00Z', 'ended'),
          lesson('soon', 'g1', '2030-01-12T09:00:00Z'),
        ],
        g2: [lesson('later', 'g2', '2030-01-11T09:00:00Z')],
      },
      assignments: [],
      now: NOW,
    })
    expect(view.next?.lesson.id).toBe('later')
    expect(view.next?.group.name).toBe('B1')
    const live = homeView({
      groups: [group('g1', 'A1')],
      lessonsByGroup: {
        g1: [
          lesson('now', 'g1', '2030-01-10T05:00:00Z', 'live'),
          lesson('soon', 'g1', '2030-01-10T07:00:00Z'),
        ],
      },
      assignments: [],
      now: NOW,
    })
    expect(live.next?.lesson.id).toBe('now')
  })

  it('lists open tests by deadline, at most three, and counts the rest', () => {
    const view = homeView({
      groups: [group('g1', 'A1')],
      lessonsByGroup: { g1: [] },
      assignments: [
        assignment('d', '2030-01-14T00:00:00Z'),
        assignment('a', '2030-01-11T00:00:00Z'),
        assignment('done', '2030-01-10T00:00:00Z', 'graded'),
        assignment('b', '2030-01-12T00:00:00Z'),
        assignment('c', '2030-01-13T00:00:00Z'),
      ],
      now: NOW,
    })
    expect(view.dueTests.map((t) => t.title)).toEqual(['a', 'b', 'c'])
    expect(view.moreTests).toBe(1)
    expect(view.next).toBeNull()
  })

  it('gives every group its own next lesson for the list', () => {
    const view = homeView({
      groups: [group('g1', 'A1'), group('g2', 'B1')],
      lessonsByGroup: {
        g1: [lesson('x', 'g1', '2030-01-12T09:00:00Z')],
        g2: [],
      },
      assignments: [],
      now: NOW,
    })
    expect(view.groups.map((g) => g.nextLesson?.id ?? null)).toEqual([
      'x',
      null,
    ])
  })
})

describe('gradingQueue', () => {
  const rec = (
    id: string,
    title: string,
    statuses: Array<'assigned' | 'submitted' | 'graded' | 'missed'>,
  ) => ({
    id,
    testId: `t-${id}`,
    title,
    deadline: '2030-01-20T00:00:00Z',
    attempts: statuses.map((status, i) => ({
      id: `${id}-${i}`,
      userId: `u${i}`,
      name: null,
      status,
      score: null,
      submittedAt: null,
    })),
  })
  it('lists assignments with submitted attempts, most waiting first, with the group', async () => {
    const { gradingQueue } = await import('./home')
    const queue = gradingQueue([group('g1', 'A1'), group('g2', 'B1')], {
      g1: [
        rec('a', 'Unit 1', ['submitted', 'graded']),
        rec('b', 'Unit 2', ['assigned']),
      ],
      g2: [rec('c', 'Unit 3', ['submitted', 'submitted', 'missed'])],
    })
    expect(queue.map((q) => [q.title, q.groupName, q.waiting])).toEqual([
      ['Unit 3', 'B1', 2],
      ['Unit 1', 'A1', 1],
    ])
  })
})
