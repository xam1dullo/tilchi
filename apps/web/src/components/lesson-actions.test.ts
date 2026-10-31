import {
  createElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { LessonRecord } from '../lib/classroom'

vi.mock('@tanstack/react-router', () => ({ Link: () => null }))
const { LessonActions } = await import('./lesson-actions')

type ButtonProps = {
  className?: string
  children?: ReactNode
  onClick?: () => void
}

function buttons(node: ReactNode): ButtonProps[] {
  if (Array.isArray(node)) return node.flatMap(buttons)
  if (!isValidElement<ButtonProps>(node)) return []
  if (node.type === 'button') return [node.props]
  if (node.type === Fragment || typeof node.type === 'string')
    return buttons(node.props.children)
  return []
}

const live: LessonRecord = {
  id: 'live',
  groupId: 'g',
  scheduledAt: '2030-01-02T06:00:00Z',
  status: 'live',
  meetingId: null,
  can: {
    start: false,
    end: true,
    cancel: false,
    reschedule: false,
    join: true,
  },
}

const view = (confirming: boolean, failed = false) => {
  const handlers = {
    onStart: vi.fn(),
    onEnd: vi.fn(),
    onCancelEnd: vi.fn(),
  }
  const props = {
    lesson: live,
    primary: true,
    busy: false,
    confirming,
    failed,
    search: { handoff: undefined, preview: undefined },
    copy: {
      start: 'Start',
      end: 'End',
      join: 'Join',
      confirmEnd: 'Confirm end',
      confirmEndHint: 'Press again',
      failed: 'Failed',
    },
    ...handlers,
  }
  const tree = LessonActions(props) as ReactElement
  const end = buttons(tree).find((b) => b.className?.includes('lesson-end'))
  const html = renderToStaticMarkup(createElement(LessonActions, props))
  return { end, handlers, html }
}

describe('LessonActions', () => {
  it('routes every End press through the confirm controller, never straight to end', () => {
    const idle = view(false)
    expect(idle.end?.children).toBe('End')
    idle.end?.onClick?.()
    expect(idle.handlers.onEnd).toHaveBeenCalledOnce()
    const armed = view(true)
    expect(armed.end?.children).toBe('Confirm end')
    expect(armed.html).toContain('aria-live="polite">Press again<')
  })

  it('shows an inline alert when the action failed', () => {
    expect(view(false).html).not.toContain('role="alert"')
    expect(view(false, true).html).toMatch(/role="alert"[^>]*>Failed</)
  })
})
