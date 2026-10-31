// A press inside this window after arming is the tail of a double tap.
export const END_GUARD_MS = 600
export const END_DISARM_MS = 8000

// Two-step End: the first press arms, a press after END_GUARD_MS ends.
// Arming lapses after END_DISARM_MS; cancel() disarms (Escape, blur, unmount).
// Keyboard auto-repeat (a held Enter) never arms or ends.
export function createEndConfirm(
  onArmedChange: (armed: boolean) => void,
  onEnd: () => void,
) {
  let armedAt: number | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => {
    clearTimeout(timer)
    if (armedAt === null) return
    armedAt = null
    onArmedChange(false)
  }
  const press = (repeat = false) => {
    if (repeat) return
    if (armedAt === null) {
      armedAt = Date.now()
      onArmedChange(true)
      timer = setTimeout(cancel, END_DISARM_MS)
      return
    }
    if (Date.now() - armedAt < END_GUARD_MS) return
    cancel()
    onEnd()
  }
  return { press, cancel }
}

// Runs a lesson action and refreshes; false means the request failed.
// A failed refresh still resolves true: the action itself succeeded.
export async function lessonAction(
  request: () => Promise<unknown>,
  refresh: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await request()
  } catch {
    return false
  }
  try {
    await refresh()
  } catch {
    // Stale view until the next load; never an unhandled rejection.
  }
  return true
}
