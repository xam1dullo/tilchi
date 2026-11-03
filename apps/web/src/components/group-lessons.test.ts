import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { LessonRecord } from '../lib/classroom'
import { formatLessonTime } from '../lib/classroom'
import { messages } from '../lib/i18n'

const state = vi.hoisted(() => ({
  lessons: [] as LessonRecord[],
  teacher: false,
  seeMembers: false,
  course: null as { id: string; title: string; level: string } | null,
  courses: [] as { id: string; title: string }[],
  myAssignments: [] as {
    groupId: string
    status: string
    score: number | null
  }[],
  members: [] as {
    id: string
    name: string | null
    role: 'learner' | 'teacher'
  }[],
  attendance: {
    attendance: [] as {
      userId: string
      name: string | null
      lessonsHeld: number
      lessonsPresent: number
    }[],
    lessons: [] as { lessonId: string; present: number }[],
  },
}))
vi.mock('../routes/app', () => ({ AppNotFound: () => null }))
vi.mock('../lib/session', () => ({ sessionData: (data: unknown) => data }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => ({
      group: {
        id: 'g',
        name: 'Group',
        learnerCount: 5,
        capacity: 12,
        course: state.course,
        can: {
          createLesson: state.teacher,
          seeMembers: state.seeMembers,
          setCourse: state.teacher,
          viewAssignments: state.seeMembers,
        },
      },
      lessons: state.lessons,
      members: state.members,
      attendance: state.attendance,
      courses: state.courses,
      myAssignments: state.myAssignments,
      tests: [],
      assignments: state.seeMembers
        ? [
            {
              id: 'a1',
              testId: 't1',
              title: 'Unit 1',
              deadline: '2030-01-05T06:00:00Z',
              attempts: [
                {
                  id: 'x1',
                  userId: 'u1',
                  name: 'Ali',
                  status: 'graded',
                  score: 8,
                  submittedAt: null,
                },
                {
                  id: 'x2',
                  userId: 'u2',
                  name: 'Vali',
                  status: 'assigned',
                  score: null,
                  submittedAt: null,
                },
              ],
            },
            {
              id: 'a2',
              testId: 't2',
              title: 'Unit 2',
              deadline: '2030-01-06T06:00:00Z',
              attempts: [
                {
                  id: 'y1',
                  userId: 'u1',
                  name: 'Ali',
                  status: 'graded',
                  score: 7,
                  submittedAt: null,
                },
                {
                  id: 'y2',
                  userId: 'u2',
                  name: 'Vali',
                  status: 'missed',
                  score: null,
                  submittedAt: null,
                },
              ],
            },
          ]
        : [],
    }),
  }),
  useRouteContext: () => ({
    locale: 'en',
    previewRole: state.teacher ? 'teacher' : 'learner',
  }),
  useRouter: () => ({}),
  Link: ({
    children,
    to,
    params,
    search: _search,
    ...props
  }: {
    children: ReactNode
    to: string
    params?: { lessonId: string }
    search?: unknown
  }) =>
    createElement(
      'a',
      { ...props, href: to.replace('$lessonId', params?.lessonId ?? '') },
      children,
    ),
}))
const { Route } = await import('../routes/app/groups/$groupId')
const copy = messages('en')
const render = () =>
  renderToStaticMarkup(createElement(Route.options.component as ComponentType))
const lesson = (
  id: string,
  status: LessonRecord['status'],
  scheduledAt: string,
): LessonRecord => ({
  id,
  groupId: 'g',
  scheduledAt,
  status,
  topic: null,
  slideUrl: null,
  canvasUrl: null,
  meetingId: null,
  // Mirrors lessonView for an enrolled learner or the enrolled group teacher.
  can: {
    start: state.teacher && status === 'scheduled',
    end: state.teacher && status === 'live',
    cancel: state.teacher && status === 'scheduled',
    reschedule: state.teacher && status === 'scheduled',
    editMaterials:
      state.teacher && (status === 'scheduled' || status === 'live'),
    join: status === 'live',
  },
})

describe('group lessons rail', () => {
  it.each([false, true])(
    'renders one labelled rail in loader order with the next action (teacher=%s)',
    (teacher) => {
      state.teacher = teacher
      state.lessons = [
        lesson('ended', 'ended', '2030-01-01T06:00:00Z'),
        lesson('later', 'scheduled', '2030-01-03T06:00:00Z'),
        lesson('next', 'scheduled', '2030-01-02T06:00:00Z'),
      ]
      const html = render()
      const rail = html.match(
        /<aside[^>]*aria-labelledby="group-lessons-title"[^>]*>([\s\S]*?)<\/aside>/,
      )?.[1]
      expect(rail).toBeDefined()
      expect(rail).toContain(
        '<h2 id="group-lessons-title" tabindex="-1">Lessons</h2>',
      )
      expect(html.match(/<ul/g)).toHaveLength(1)
      expect(rail).toContain(copy.lessonEnded)
      expect(rail).toContain(copy.lessonScheduled)
      const times = state.lessons.map((l) =>
        formatLessonTime(l.scheduledAt, 'en'),
      )
      expect(rail?.indexOf(times[0])).toBeLessThan(rail?.indexOf(times[1]) ?? 0)
      expect(rail?.indexOf(times[1])).toBeLessThan(rail?.indexOf(times[2]) ?? 0)
      const footer = rail?.slice(0, rail.indexOf('<ul'))
      expect(footer).not.toContain('lesson-actions')
      expect(footer).not.toContain('group-lesson-primary')
    },
  )
  it.each([false, true])(
    'prioritizes the live lesson above the list (teacher=%s)',
    (teacher) => {
      state.teacher = teacher
      state.lessons = [
        lesson('future', 'scheduled', '2030-01-03T06:00:00Z'),
        lesson('live', 'live', '2030-01-02T06:00:00Z'),
      ]
      const html = render()
      const footer = html.slice(html.indexOf('<aside'), html.indexOf('<ul'))
      expect(footer).toContain('/app/meet/live')
      expect(footer).not.toContain(copy.startLesson)
      if (teacher) expect(footer).toContain(copy.endLesson)
      expect(footer).toContain('aria-describedby="primary-lesson-time-live"')
      expect(footer).toContain('<time id="primary-lesson-time-live"')
      expect(footer).toContain(
        formatLessonTime(state.lessons[1].scheduledAt, 'en'),
      )
      expect(footer).toContain(copy.lessonLive)
    },
  )
  it('keeps scheduled row actions and no primary until the client clock is known', () => {
    state.teacher = true
    state.lessons = [
      lesson('overdue', 'scheduled', '2020-01-01T06:00:00Z'),
      lesson('upcoming', 'scheduled', '2099-01-01T06:00:00Z'),
    ]
    const html = render()
    const primary = html.slice(html.indexOf('<aside'), html.indexOf('<ul'))
    expect(primary).not.toContain('lesson-actions')
    const rows = html.slice(html.indexOf('<ul'), html.indexOf('</ul>'))
    expect(rows).toContain(copy.startLesson)
    expect(html).not.toContain('<section class="group-lessons-scroll"')
    expect(html).not.toContain('tabindex="0"')
  })
  it('places scheduling before main content and main content before the rail', () => {
    state.teacher = true
    state.lessons = []
    const html = render()
    expect(html.indexOf('group-schedule')).toBeGreaterThan(-1)
    expect(html.indexOf('group-schedule')).toBeLessThan(
      html.indexOf('group-layout'),
    )
    expect(html.indexOf('group-main')).toBeLessThan(html.indexOf('<aside'))
  })
  it('leads the live lesson with Join and keeps End as a secondary danger action', () => {
    state.teacher = true
    state.lessons = [lesson('live', 'live', '2030-01-02T06:00:00Z')]
    const html = render()
    const primary = html.slice(html.indexOf('<aside'), html.indexOf('<ul'))
    const join = primary.indexOf('/app/meet/live')
    const end = primary.indexOf(copy.endLesson)
    expect(join).toBeGreaterThan(-1)
    expect(join).toBeLessThan(end)
    expect(primary).toMatch(
      /<a class="btn btn-primary"[^>]*href="\/app\/meet\/live"/,
    )
    expect(primary).toMatch(/<button class="btn btn-outline lesson-end"/)
    expect(primary).not.toContain(copy.confirmEndLesson)
  })
  it('shows the topic under the time and a materials form only for whoever may edit', () => {
    state.teacher = true
    state.lessons = [
      {
        ...lesson('next', 'scheduled', '2030-01-02T06:00:00Z'),
        topic: 'Unit 1',
      },
      { ...lesson('done', 'ended', '2030-01-01T06:00:00Z'), topic: 'Unit 0' },
    ]
    const html = render()
    const rows = html.slice(html.indexOf('<ul'), html.indexOf('</ul>'))
    const next = rows.slice(0, rows.indexOf('lesson-time-done'))
    expect(next.indexOf('lesson-time-next')).toBeLessThan(
      next.indexOf('Unit 1'),
    )
    expect(next).toContain('lesson-materials')
    expect(next).toContain('name="slideUrl"')
    expect(rows.slice(rows.indexOf('lesson-time-done'))).not.toContain(
      'lesson-materials',
    )
    state.teacher = false
    state.lessons = [
      {
        ...lesson('next', 'scheduled', '2030-01-02T06:00:00Z'),
        topic: 'Unit 1',
      },
    ]
    expect(render()).not.toContain('lesson-materials')
    expect(render()).toContain('Unit 1')
  })
  it('asks for a topic and two links when scheduling', () => {
    state.teacher = true
    state.lessons = []
    const form = render().match(/<form[^>]*group-schedule[\s\S]*?<\/form>/)?.[0]
    expect(form).toContain('name="topic"')
    expect(form).toMatch(/<input type="url"[^>]*name="slideUrl"/)
    expect(form).toMatch(/<input type="url"[^>]*name="canvasUrl"/)
    expect(form).toMatch(/maxLength="120"[^>]*name="topic"/)
    expect(form).toContain(copy.lessonTopic)
  })
  it('keeps the empty state inside the labelled rail', () => {
    state.lessons = []
    const html = render()
    expect(html).toMatch(
      /<aside[^>]*aria-labelledby="group-lessons-title"[^>]*>[\s\S]*No lessons yet\.[\s\S]*<\/aside>/,
    )
    expect(html).not.toContain('<ul')
    expect(html).not.toContain('lesson-actions')
  })
})

describe('attendance on the group page', () => {
  const ended = lesson('done', 'ended', '2030-01-01T06:00:00Z')
  const next = lesson('next', 'scheduled', '2030-01-02T06:00:00Z')
  it('shows present/members on an ended lesson row and per-member figures to the teacher', () => {
    state.teacher = true
    state.seeMembers = true
    state.lessons = [ended, next]
    state.members = [
      { id: 't', name: 'T', role: 'teacher' },
      { id: 'u1', name: 'Ali', role: 'learner' },
    ]
    state.attendance = {
      attendance: [
        { userId: 'u1', name: 'Ali', lessonsHeld: 5, lessonsPresent: 4 },
      ],
      lessons: [{ lessonId: 'done', present: 3 }],
    }
    const html = render()
    const rows = html.slice(html.indexOf('<ul'), html.lastIndexOf('</ul>'))
    const doneRow = rows.slice(
      rows.indexOf('lesson-time-done'),
      rows.indexOf('lesson-time-next'),
    )
    expect(doneRow).toContain(`${copy.attendance} <span class="num">3/5</span>`)
    expect(rows.slice(rows.indexOf('lesson-time-next'))).not.toContain(
      copy.attendance,
    )
    const members = html.match(
      /<section class="members"[\s\S]*?<\/section>/,
    )?.[0]
    // One quiet line per learner: attendance, tests graded of assigned, mean score.
    expect(members).toContain(
      `<p class="figures"><span>${copy.attendance} <span class="num">4/5</span></span><span> <span aria-hidden="true">·</span> ${copy.progressTests} <span class="num">2/2</span></span><span> <span aria-hidden="true">·</span> ${copy.progressAverage} <span class="num">7.5</span></span></p>`,
    )
    expect(members?.indexOf('4/5')).toBeGreaterThan(members?.indexOf('T') ?? 0)
    // The teacher row carries no figures; no attendance line in the header either.
    expect(members?.match(/class="figures"/g)).toHaveLength(1)
    expect(html.slice(0, html.indexOf('group-layout'))).not.toContain(
      'class="figures"',
    )
  })
  it('shows tests without attendance and nothing for a learner with neither', () => {
    state.teacher = true
    state.seeMembers = true
    state.lessons = []
    state.members = [
      { id: 'u2', name: 'Vali', role: 'learner' },
      { id: 'u3', name: 'Zero', role: 'learner' },
    ]
    state.attendance = { attendance: [], lessons: [] }
    const html = render()
    const members = html.match(
      /<section class="members"[\s\S]*?<\/section>/,
    )?.[0]
    expect(members).toContain(
      `<p class="figures"><span>${copy.progressTests} <span class="num">0/2</span></span></p>`,
    )
    expect(members).not.toContain(copy.progressAverage)
    expect(members?.match(/class="figures"/g)).toHaveLength(1)
  })
  it('shows a learner only their own attendance line, never other members', () => {
    state.teacher = false
    state.seeMembers = false
    state.lessons = [ended]
    state.members = []
    state.attendance = {
      attendance: [
        { userId: 'me', name: 'Me', lessonsHeld: 5, lessonsPresent: 4 },
      ],
      lessons: [],
    }
    const html = render()
    expect(html).toContain(
      `<p class="figures"><span>${copy.attendance} <span class="num">4/5</span></span></p>`,
    )
    expect(html).not.toContain('3/5')
    expect(html).not.toContain('<section class="members"')
    // Their own tests join the line; another group's test does not.
    state.myAssignments = [
      { groupId: 'g', status: 'graded', score: 9 },
      { groupId: 'other', status: 'graded', score: 1 },
    ]
    expect(render()).toContain(
      `<span class="num">4/5</span></span><span> <span aria-hidden="true">·</span> ${copy.progressTests} <span class="num">1/1</span></span><span> <span aria-hidden="true">·</span> ${copy.progressAverage} <span class="num">9</span></span></p>`,
    )
    state.myAssignments = []
    state.attendance = { attendance: [], lessons: [] }
    expect(render()).not.toContain('class="figures"')
    state.attendance = {
      attendance: [
        { userId: 'me', name: 'Me', lessonsHeld: 0, lessonsPresent: 0 },
      ],
      lessons: [],
    }
    expect(render()).not.toContain('class="figures"')
  })
})

describe('course on the group page', () => {
  it('names the course under the group name and lets a manager change it', () => {
    state.teacher = true
    state.seeMembers = true
    state.lessons = []
    state.members = []
    state.course = { id: 'c1', title: 'General English', level: 'orta' }
    state.courses = [
      { id: 'c1', title: 'General English' },
      { id: 'c2', title: 'IELTS' },
    ]
    const html = render()
    const head = html.slice(0, html.indexOf('group-layout'))
    expect(head).toContain('<h1>Group</h1><p class="hint">General English</p>')
    expect(head).toContain(`<span class="sr-only">${copy.courseSelect}</span>`)
    expect(head).toContain(
      '<option value="c1" selected="">General English</option>',
    )
    expect(head).toContain('<option value="c2">IELTS</option>')
    expect(head).toContain(`<option value="">${copy.courseNone}</option>`)
  })
  it('keeps an unlisted current course selectable and hides the select from learners', () => {
    state.teacher = true
    state.course = { id: 'c9', title: 'Old draft', level: 'orta' }
    state.courses = [{ id: 'c2', title: 'IELTS' }]
    expect(render()).toContain(
      '<option value="c9" selected="">Old draft</option>',
    )
    state.teacher = false
    state.seeMembers = false
    const html = render()
    expect(html).toContain('<p class="hint">Old draft</p>')
    expect(html).not.toContain('<select')
    state.course = null
    expect(render()).not.toContain('<p class="hint">Old draft</p>')
  })
})
