import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LessonStatus } from '../../lib/classroom'
import { copy } from '../../lib/i18n'
import { MeetEntry } from './meet-room'

const en = copy.en

const render = (status: LessonStatus) =>
  renderToStaticMarkup(
    createElement(MeetEntry, {
      status,
      lessonId: 'lesson-1',
      previewRole: null,
      copy: en,
      onLeave: () => undefined,
    }),
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MeetEntry', () => {
  it.each(['scheduled', 'ended', 'cancelled'] as const)(
    'waits instead of joining while the lesson is %s',
    (status) => {
      const html = render(status)
      expect(html).toContain(en.meetWaiting)
      expect(html).not.toContain('Meeting controls')
    },
  )

  it('shows the meeting, starting from connecting, while the lesson is live', () => {
    const html = render('live')
    expect(html).toContain('Connecting to the meeting…')
    expect(html).toContain('>Meeting controls<')
    expect(html).not.toContain(en.meetWaiting)
  })

  it('does not contact the server while rendering: joining belongs to effects', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render('live')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
