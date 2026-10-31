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
      group: { id: 'g', name: 'Group', learnerCount: 1, capacity: 12, can: {} },
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
  can: {
    start: state.teacher && status === 'scheduled',
    end: false,
    cancel: false,
    reschedule: false,
    join: !state.teacher && status === 'scheduled',
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
      const footer = rail?.slice(rail.indexOf('</ul>'))
      expect(footer).toContain('class="btn btn-primary"')
      expect(footer).toContain(teacher ? copy.startLesson : copy.joinMeet)
      expect(footer).not.toContain(teacher ? copy.joinMeet : copy.startLesson)
      if (!teacher) {
        expect(footer).toContain('/app/meet/next')
        expect(html.match(/href="\/app\/meet\/next"/g)).toHaveLength(1)
      }
    },
  )
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
