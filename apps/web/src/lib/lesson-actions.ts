// A press inside this window after arming is the tail of a double tap.
export const END_GUARD_MS = 600
export const END_DISARM_MS = 8000

// Two-step End: the first press arms, a press after END_GUARD_MS ends.
// Arming lapses after END_DISARM_MS; cancel() disarms (Escape, blur, unmount).
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
  const press = () => {
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
export async function lessonAction(
  request: () => Promise<unknown>,
  refresh: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await request()
  } catch {
    return false
  }
  await refresh()
  return true
}
