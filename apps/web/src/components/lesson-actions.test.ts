import {
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
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

const view = (confirming: boolean) => {
  const handlers = {
    onStart: vi.fn(),
    onArmEnd: vi.fn(),
    onConfirmEnd: vi.fn(),
    onCancelEnd: vi.fn(),
  }
  const tree = LessonActions({
    lesson: live,
    primary: true,
    busy: false,
    confirming,
    search: { handoff: undefined, preview: undefined },
    copy: {
      start: 'Start',
      end: 'End',
      join: 'Join',
      confirmEnd: 'Confirm end',
      confirmEndHint: 'Press again',
    },
    ...handlers,
  }) as ReactElement
  const end = buttons(tree).find((b) => b.className?.includes('lesson-end'))
  return { tree, end, handlers }
}

describe('LessonActions end confirmation', () => {
  it('only arms on the first press and never ends the lesson', () => {
    const { end, handlers } = view(false)
    expect(end?.children).toBe('End')
    end?.onClick?.()
    expect(handlers.onArmEnd).toHaveBeenCalledOnce()
    expect(handlers.onConfirmEnd).not.toHaveBeenCalled()
  })

  it('ends the lesson on the confirming press', () => {
    const { end, handlers } = view(true)
    expect(end?.children).toBe('Confirm end')
    end?.onClick?.()
    expect(handlers.onConfirmEnd).toHaveBeenCalledOnce()
    expect(handlers.onArmEnd).not.toHaveBeenCalled()
  })
})
