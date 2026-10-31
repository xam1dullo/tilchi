import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MyAssignment } from '../lib/attempt'
import { copy } from '../lib/i18n'
import { MyTestsView } from './my-tests'

function elements(
  node: ReactNode,
  type: string,
): Array<Record<string, unknown>> {
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, type))
  if (!isValidElement<{ children?: ReactNode }>(node)) return []
  return [
    ...(node.type === type ? [node.props] : []),
    ...elements(node.props.children, type),
  ]
}

const assignments: MyAssignment[] = ['assigned', 'graded'].map((status, i) => ({
  attemptId: `attempt-${i}`,
  assignmentId: `assignment-${i}`,
  groupId: 'group',
  groupName: 'Group',
  title: status,
  deadline: '2026-10-31T10:00:00Z',
  status: status as MyAssignment['status'],
  score: status === 'graded' ? 90 : null,
  submittedAt: null,
}))
const props = {
  assignments,
  copy: copy.en,
  locale: 'en',
  previewRole: null,
  onFilter: vi.fn(),
}

describe('assignment filter rendering', () => {
  it('renders only graded list items for the graded filter', () => {
    const rows = elements(MyTestsView({ ...props, filter: 'graded' }), 'li')
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(rows)).toContain('attempt-1')
    expect(JSON.stringify(rows)).not.toContain('attempt-0')
  })

  it('renders the filtered empty message when no assignments match', () => {
    const tree = MyTestsView({ ...props, filter: 'missed' })
    expect(elements(tree, 'li')).toHaveLength(0)
    expect(elements(tree, 'p').map((p) => p.children)).toContain(
      copy.en.assignmentFilterEmpty,
    )
  })

  it('emits the clicked pill value and reflects the supplied filter', () => {
    const onFilter = vi.fn()
    const buttons = elements(
      MyTestsView({ ...props, filter: 'all', onFilter }),
      'button',
    )
    expect(buttons.map((b) => b['aria-pressed'])).toEqual([
      true,
      false,
      false,
      false,
      false,
    ])
    ;(buttons[3].onClick as () => void)()
    expect(onFilter).toHaveBeenCalledExactlyOnceWith('graded')
    const selected = elements(
      MyTestsView({ ...props, filter: 'graded', onFilter }),
      'button',
    )
    expect(selected.map((b) => b['aria-pressed'])).toEqual([
      false,
      false,
      false,
      true,
      false,
    ])
  })

  it('hides filters and retains the empty message when there are no assignments', () => {
    const tree = MyTestsView({ ...props, assignments: [], filter: 'all' })
    expect(elements(tree, 'fieldset')).toHaveLength(0)
    expect(elements(tree, 'p').map((p) => p.children)).toContain(
      copy.en.myTestsEmpty,
    )
  })

  it('uses the submitted status wording and separates accessible counts', () => {
    const buttons = elements(MyTestsView({ ...props, filter: 'all' }), 'button')
    expect(buttons[0]['aria-label']).toBe(`${copy.en.assignmentFilterAll}: 2`)
    expect(buttons[2]['aria-label']).toBe(`${copy.en.attemptSubmitted}: 0`)
  })
})
