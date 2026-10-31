import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  END_DISARM_MS,
  END_GUARD_MS,
  createEndConfirm,
  lessonAction,
} from './lesson-actions'

describe('createEndConfirm', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const setup = () => {
    const armed = vi.fn()
    const end = vi.fn()
    return { armed, end, confirm: createEndConfirm(armed, end) }
  }

  it('ignores a double tap and ends only on a deliberate second press', () => {
    const { armed, end, confirm } = setup()
    confirm.press()
    expect(armed).toHaveBeenLastCalledWith(true)
    confirm.press()
    vi.advanceTimersByTime(END_GUARD_MS - 1)
    confirm.press()
    expect(end).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    confirm.press()
    expect(end).toHaveBeenCalledOnce()
    expect(armed).toHaveBeenLastCalledWith(false)
  })

  it(`disarms after ${END_DISARM_MS}ms so a later press only re-arms`, () => {
    const { armed, end, confirm } = setup()
    confirm.press()
    vi.advanceTimersByTime(END_DISARM_MS - 1)
    expect(armed).toHaveBeenLastCalledWith(true)
    vi.advanceTimersByTime(1)
    expect(armed).toHaveBeenLastCalledWith(false)
    confirm.press()
    expect(end).not.toHaveBeenCalled()
    expect(armed).toHaveBeenLastCalledWith(true)
  })

  it('ignores keyboard auto-repeat from a held key', () => {
    const { armed, end, confirm } = setup()
    confirm.press(true)
    expect(armed).not.toHaveBeenCalled()
    confirm.press()
    vi.advanceTimersByTime(END_GUARD_MS * 2)
    confirm.press(true)
    expect(end).not.toHaveBeenCalled()
    expect(armed).toHaveBeenLastCalledWith(true)
  })

  it('cancel (Escape, blur) disarms without ending', () => {
    const { armed, end, confirm } = setup()
    confirm.press()
    vi.advanceTimersByTime(END_GUARD_MS)
    confirm.cancel()
    expect(armed).toHaveBeenLastCalledWith(false)
    confirm.press()
    expect(end).not.toHaveBeenCalled()
    vi.advanceTimersByTime(END_DISARM_MS)
    expect(armed).toHaveBeenCalledTimes(4)
  })
})

describe('lessonAction', () => {
  it('reports a failed request and skips the refresh', async () => {
    const refresh = vi.fn(async () => {})
    await expect(
      lessonAction(() => Promise.reject(new Error('500')), refresh),
    ).resolves.toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes after a successful request', async () => {
    const refresh = vi.fn(async () => {})
    await expect(lessonAction(async () => ({}), refresh)).resolves.toBe(true)
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('still reports success when the refresh fails', async () => {
    const refresh = vi.fn(() => Promise.reject(new Error('offline')))
    await expect(lessonAction(async () => ({}), refresh)).resolves.toBe(true)
    expect(refresh).toHaveBeenCalledOnce()
  })
})
