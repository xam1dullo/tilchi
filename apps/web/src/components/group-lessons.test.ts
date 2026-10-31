import { createElement, type ComponentType, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { LessonRecord } from '../lib/classroom'
import { formatLessonTime } from '../lib/classroom'
import { messages } from '../lib/i18n'

const state = vi.hoisted(() => ({
  lessons: [] as LessonRecord[],
  teacher: false,
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
        learnerCount: 1,
        capacity: 12,
        can: { createLesson: state.teacher },
      },
      lessons: state.lessons,
      members: [],
      tests: [],
      assignments: [],
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
  meetingId: null,
  // Mirrors lessonView for an enrolled learner or the enrolled group teacher.
  can: {
    start: state.teacher && status === 'scheduled',
    end: state.teacher && status === 'live',
    cancel: state.teacher && status === 'scheduled',
    reschedule: state.teacher && status === 'scheduled',
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
      expect(rail).toContain('<h3 id="group-lessons-title">Lessons</h3>')
      expect(html.match(/<ul/g)).toHaveLength(1)
      expect(rail).toContain(copy.lessonEnded)
      expect(rail).toContain(copy.lessonScheduled)
      const times = state.lessons.map((l) =>
        formatLessonTime(l.scheduledAt, 'en'),
      )
      expect(rail?.indexOf(times[0])).toBeLessThan(rail?.indexOf(times[1]) ?? 0)
      expect(rail?.indexOf(times[1])).toBeLessThan(rail?.indexOf(times[2]) ?? 0)
      const footer = rail?.slice(0, rail.indexOf('<ul'))
      if (!teacher) {
        expect(footer).not.toContain('lesson-actions')
        return
      }
      expect(footer).toContain('class="btn btn-primary"')
      expect(footer).toContain(copy.startLesson)
      expect(footer).not.toContain(copy.joinMeet)
      expect(footer).toContain('aria-describedby="lesson-time-next"')
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
      expect(footer).toContain('aria-describedby="lesson-time-live"')
      expect(html).toContain('<time id="lesson-time-live"')
    },
  )
  it('keeps overdue row actions while promoting the upcoming lesson', () => {
    state.teacher = true
    state.lessons = [
      lesson('overdue', 'scheduled', '2020-01-01T06:00:00Z'),
      lesson('upcoming', 'scheduled', '2099-01-01T06:00:00Z'),
    ]
    const html = render()
    const primary = html.slice(html.indexOf('<aside'), html.indexOf('<ul'))
    expect(primary).toContain('aria-describedby="lesson-time-upcoming"')
    const rows = html.slice(html.indexOf('<ul'), html.indexOf('</ul>'))
    expect(rows).toContain(copy.startLesson)
    expect(html).toContain(
      '<section class="group-lessons-scroll" aria-labelledby="group-lessons-title"',
    )
    expect(html).toContain('tabindex="0"')
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
