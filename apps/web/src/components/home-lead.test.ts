import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { LessonRecord } from '../lib/classroom'
import { messages } from '../lib/i18n'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) =>
    createElement('a', { href: to }, children),
}))
const { HomeLead } = await import('./home-lead')

const lesson = (topic: string | null): LessonRecord => ({
  id: 'l1',
  groupId: 'g',
  scheduledAt: '2030-01-02T04:00:00.000Z',
  status: 'scheduled',
  topic,
  slideUrl: null,
  canvasUrl: null,
  meetingId: null,
  can: {
    start: false,
    end: false,
    cancel: false,
    reschedule: false,
    editMaterials: false,
    join: false,
  },
})
const render = (topic: string | null) =>
  renderToStaticMarkup(
    createElement(HomeLead, {
      next: { lesson: lesson(topic), group: { id: 'g', name: 'A1' } },
      copy: messages('uz'),
      locale: 'uz',
      search: {},
    } as never),
  )

describe('HomeLead', () => {
  it('puts the topic above the time, and nothing when there is none', () => {
    const html = render('Unit 1')
    expect(html).toContain('home-lead-topic')
    expect(html.indexOf('Unit 1')).toBeLessThan(html.indexOf('<time'))
    expect(render(null)).not.toContain('home-lead-topic')
  })
})
