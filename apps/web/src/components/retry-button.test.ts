import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

const invalidate = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate }) }))

const { RetryButton } = await import('./retry-button')

describe('RetryButton', () => {
  it('reloads the route loaders, not just the error boundary', () => {
    const button = RetryButton({ label: 'Retry' }) as ReactElement<{
      onClick: () => void
      children: string
    }>
    expect(button.props.children).toBe('Retry')
    button.props.onClick()
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})
